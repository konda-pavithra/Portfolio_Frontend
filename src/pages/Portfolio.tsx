import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStocks,
  getPortfolio,
  addStock,
  updateStock,
  deleteStock,
  getValuation,
  uploadPortfolio,
  confirmUpload,
} from '../api/portfolio';
import type {
  NseStock,
  PortfolioItem,
  HoldingValuation,
  PortfolioUploadPreview,
} from '../api/portfolio';
import '../styles/portfolio.css';

export default function Portfolio() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'User';

  const [stocks, setStocks] = useState<NseStock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [valuations, setValuations] = useState<HoldingValuation[]>([]);

  // add-form state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NseStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<NseStock | null>(null);
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [formError, setFormError] = useState('');

  // navbar search
  const [navSearch, setNavSearch] = useState('');

  // edit modal state
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<PortfolioUploadPreview | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    loadData();

    // SSE stream: drive ticker bar with user's own holdings
    const es = new EventSource(
      `http://localhost:8080/api/portfolio/stream?token=${encodeURIComponent(token)}`
    );
    es.addEventListener('portfolio-update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data.holdings)) {
          setTickerHoldings(
            data.holdings.map((h: any) => ({
              symbol: h.symbol,
              displaySymbol: h.displaySymbol,
              companyName: h.companyName,
              quantity: h.quantity,
              buyingPrice: h.buyingPrice,
              investmentValue: h.investmentValue,
              currentPrice: h.currentPrice,
              currentValue: h.currentValue,
              profitLoss: h.profitLoss,
              plPercent: h.plPercent,
              gain: h.gain,
              marketState: h.marketState,
            }))
          );
        }
      } catch {
        // malformed event — ignore
      }
    });
    es.onerror = () => es.close();

    return () => es.close();
  }, []);

  const loadData = async () => {
    try {
      const [stocksRes, portfolioRes, valuationRes] = await Promise.all([
        getStocks(),
        getPortfolio(),
        getValuation(),
      ]);
      setStocks(stocksRes.data);
      setPortfolio(portfolioRes.data);
      setValuations(valuationRes.data.holdings || []);
    } catch {
      // 401 is handled by the axios interceptor
    }
  };

  // merge portfolio row with its live valuation data
  const getValuationFor = (symbol: string) =>
    valuations.find((v) => v.symbol === symbol);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedStock(null);
    setFormError('');
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = val.toLowerCase();
    setSuggestions(
      stocks
        .filter(
          (s) =>
            s.companyName.toLowerCase().includes(lower) ||
            s.displaySymbol.toLowerCase().includes(lower)
        )
        .slice(0, 8)
    );
  };

  const pickSuggestion = (stock: NseStock) => {
    setSelectedStock(stock);
    setQuery(stock.companyName);
    setSuggestions([]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) {
      setFormError('Please select a company from the list.');
      return;
    }
    const qty = parseInt(quantity, 10);
    const price = parseFloat(buyPrice);
    if (!qty || qty <= 0 || !price || price <= 0) {
      setFormError('Enter a valid quantity and price.');
      return;
    }
    try {
      await addStock({ symbol: selectedStock.symbol, quantity: qty, buyingPrice: price });
      setQuery('');
      setSelectedStock(null);
      setQuantity('');
      setBuyPrice('');
      setFormError('');
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Failed to add stock.';
      setFormError(typeof msg === 'string' ? msg : 'Failed to add stock.');
    }
  };

  const openEdit = (item: PortfolioItem) => {
    setEditItem(item);
    setEditQty(String(item.quantity));
    setEditPrice(String(item.buyingPrice));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      await updateStock(editItem.symbol, {
        symbol: editItem.symbol,
        quantity: parseInt(editQty, 10),
        buyingPrice: parseFloat(editPrice),
      });
      setEditItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleDelete = async (symbol: string) => {
    if (!confirm(`Remove ${symbol} from your portfolio?`)) return;
    try {
      await deleteStock(symbol);
      await loadData();
    } catch {
      alert('Delete failed.');
    }
  };

  const handleImportClick = () => {
    setImportError('');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setImportError('Please select a valid Excel file (.xlsx or .xls).');
      e.target.value = '';
      return;
    }
    setImporting(true);
    setImportError('');
    try {
      const res = await uploadPortfolio(file);
      const preview = res.data;
      // No new or updatable stocks — nothing to apply
      if (preview.newStocks.length === 0 && preview.stocksToUpdate.length === 0) {
        setImportError(preview.userMessage || 'No valid portfolio data found in the file.');
      } else {
        setUploadPreview(preview);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Import failed.';
      setImportError(typeof msg === 'string' ? msg : 'Import failed.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    if (!uploadPreview) return;
    setConfirming(true);
    try {
      // Map stocksToUpdate → PortfolioEntry shape expected by /confirm
      const toUpdate = uploadPreview.stocksToUpdate.map((u) => ({
        symbol: u.symbol,
        displaySymbol: u.displaySymbol,
        companyName: u.companyName,
        quantity: u.newQuantity,
        buyingPrice: u.newBuyingPrice,
      }));
      await confirmUpload({ toAdd: uploadPreview.newStocks, toUpdate });
      setUploadPreview(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Confirm failed.';
      setImportError(typeof msg === 'string' ? msg : 'Confirm failed.');
      setUploadPreview(null);
    } finally {
      setConfirming(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const fmt = (n: number | undefined) => {
    if (n === undefined || n === null) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // SSE-driven ticker: user's own holdings with live gain/loss
  const [tickerHoldings, setTickerHoldings] = useState<HoldingValuation[]>([]);

  return (
    <div className="portfolio-page">

      {/* ── navbar ── */}
      <nav className="navbar">
        <div className="nav-logo">portfolio<span>alert</span></div>
        <div className="nav-links">
          <span className="nav-link active">PORTFOLIOS</span>
          <span className="nav-link">ALERTS</span>
        </div>
        <div className="nav-search">
          <span className="search-icon">&#128269;</span>
          <input
            type="text"
            placeholder="Search portfolio..."
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
        </div>
        <div className="nav-user" onClick={handleLogout} title="Click to logout">
          <span className="user-icon">&#128100;</span>
          {username.toUpperCase()}
          <span className="chevron">&#9660;</span>
        </div>
      </nav>

      {/* ── add stock card ── */}
      <div className="add-card">
        <h2>Add companies to Core Watchlist</h2>
        <p className="add-sub">
          Keep track of latest announcements, insider trades and credit ratings of your portfolio.
        </p>

        <form className="add-form" onSubmit={handleAdd}>
          <div className="add-fields">
            <div className="add-field">
              <label>Company Name</label>
              <div className="autocomplete-wrap" ref={dropdownRef}>
                <input
                  type="text"
                  placeholder="Search by company name or ticker..."
                  value={query}
                  onChange={handleQueryChange}
                />
                {suggestions.length > 0 && (
                  <ul className="suggestions">
                    {suggestions.map((s) => (
                      <li key={s.symbol} onClick={() => pickSuggestion(s)}>
                        <span className="s-badge">{s.displaySymbol}</span>
                        {s.companyName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="add-field add-field--sm">
              <label>Quantity</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>

            <div className="add-field add-field--sm">
              <label>Buy Price (₹)</label>
              <input
                type="number"
                placeholder="e.g. 1500"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
          </div>

          {formError && <p className="form-error">{formError}</p>}

          {importError && <p className="form-error">{importError}</p>}

          <div className="add-actions">
            <button type="submit" className="btn-add">ADD</button>
            <button
              type="button"
              className="btn-import"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'IMPORTING...' : 'IMPORT (.XLSX)'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </form>
      </div>

      {/* ── holdings table ── */}
      {portfolio.length > 0 && (
        <div className="table-wrap">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Ticker</th>
                <th>Quantity</th>
                <th>Avg Buy<br />Price</th>
                <th>LTP<br />(Live)</th>
                <th>Current<br />Value</th>
                <th>Gain/Loss</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((item) => {
                const v = getValuationFor(item.symbol);
                const isGain = v ? v.gain : true;
                return (
                  <tr key={item.id}>
                    <td className="td-company">{item.companyName}</td>
                    <td className="td-ticker">{item.displaySymbol}</td>
                    <td>{item.quantity}</td>
                    <td>₹{fmt(item.buyingPrice)}</td>
                    <td>{v ? `₹${fmt(v.currentPrice)}` : '—'}</td>
                    <td>{v ? `₹${fmt(v.currentValue)}` : '—'}</td>
                    <td className={isGain ? 'gain' : 'loss'}>
                      {v ? (
                        <>
                          {isGain ? '+' : ''}₹{fmt(v.profitLoss)}
                          <br />
                          <span className="pl-pct">
                            ({v.plPercent.toFixed(2)}%)
                          </span>
                        </>
                      ) : '—'}
                    </td>
                    <td className="td-actions">
                      <button className="action-edit" onClick={() => openEdit(item)}>Edit</button>
                      <button className="action-delete" onClick={() => handleDelete(item.symbol)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {portfolio.length === 0 && (
        <p className="empty-msg">No holdings yet. Add a company above to get started.</p>
      )}

      {/* ── upload preview modal ── */}
      {uploadPreview && (
        <div className="modal-overlay" onClick={() => setUploadPreview(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <h3>Review Import</h3>
            <p className="upload-user-msg">{uploadPreview.userMessage}</p>

            {uploadPreview.newStocks.length > 0 && (
              <div className="upload-section">
                <h4>New stocks to add ({uploadPreview.newStocks.length})</h4>
                <table className="upload-table">
                  <thead>
                    <tr><th>Company</th><th>Ticker</th><th>Qty</th><th>Buy Price (₹)</th></tr>
                  </thead>
                  <tbody>
                    {uploadPreview.newStocks.map((s) => (
                      <tr key={s.symbol}>
                        <td>{s.companyName}</td>
                        <td className="td-ticker">{s.displaySymbol}</td>
                        <td>{s.quantity}</td>
                        <td>{Number(s.buyingPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {uploadPreview.stocksToUpdate.length > 0 && (
              <div className="upload-section">
                <h4>Existing holdings to update ({uploadPreview.stocksToUpdate.length})</h4>
                <table className="upload-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Ticker</th>
                      <th>Qty (current → new)</th>
                      <th>Buy Price (current → new)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.stocksToUpdate.map((u) => (
                      <tr key={u.symbol}>
                        <td>{u.companyName}</td>
                        <td className="td-ticker">{u.displaySymbol}</td>
                        <td>{u.currentQuantity} → <strong>{u.newQuantity}</strong></td>
                        <td>₹{Number(u.currentBuyingPrice).toFixed(2)} → <strong>₹{Number(u.newBuyingPrice).toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {uploadPreview.invalidSymbols.length > 0 && (
              <p className="upload-warn">
                Skipped unrecognised symbols: {uploadPreview.invalidSymbols.join(', ')}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="btn-add"
                onClick={handleConfirmUpload}
                disabled={confirming}
              >
                {confirming ? 'Applying...' : 'Confirm & Apply'}
              </button>
              <button className="btn-import" onClick={() => setUploadPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── edit modal ── */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editItem.companyName}</h3>
            <form onSubmit={handleUpdate}>
              <label>Quantity</label>
              <input
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                min="1"
                required
              />
              <label>Buy Price (₹)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                min="0.01"
                step="0.01"
                required
              />
              <div className="modal-actions">
                <button type="submit" className="btn-add">Save</button>
                <button type="button" className="btn-import" onClick={() => setEditItem(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── live ticker bar — user holdings only ── */}
      {tickerHoldings.length > 0 && (
        <div className="ticker-bar">
          <div className="ticker-track">
            {/* duplicate list so the scroll feels continuous */}
            {[...tickerHoldings, ...tickerHoldings].map((h, i) => (
              <span key={i} className="ticker-item">
                {h.displaySymbol}
                <span className={h.gain ? 'tick-up' : 'tick-down'}>
                  {' '}₹{fmt(h.currentPrice)}{' '}
                  {h.gain ? '+' : ''}{h.plPercent.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
