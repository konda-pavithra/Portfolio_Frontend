import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStocks,
  getPortfolio,
  addStock,
  updateStock,
  deleteStock,
  getValuation,
} from '../api/portfolio';
import type { NseStock, PortfolioItem, HoldingValuation } from '../api/portfolio';
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

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    loadData();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const fmt = (n: number | undefined) => {
    if (n === undefined || n === null) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ticker symbols shown at the bottom bar
  const tickerSymbols = ['HDFCBANK', 'INFY', 'ITC', 'SBIN', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC', 'SBIN', 'RELIANCE', 'TCS'];

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

          <div className="add-actions">
            <button type="submit" className="btn-add">ADD</button>
            <button type="button" className="btn-import">IMPORT (.XLSX)</button>
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

      {/* ── live ticker bar ── */}
      <div className="ticker-bar">
        <div className="ticker-track">
          {tickerSymbols.map((t, i) => {
            const v = valuations.find((val) => val.displaySymbol === t || val.symbol.startsWith(t));
            return (
              <span key={i} className="ticker-item">
                {t}
                {v ? (
                  <span className={v.gain ? 'tick-up' : 'tick-down'}>
                    {' '}{fmt(v.currentPrice)} {v.gain ? '+' : ''}{v.plPercent.toFixed(2)}%
                  </span>
                ) : (
                  <span className="tick-neutral"> —</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
