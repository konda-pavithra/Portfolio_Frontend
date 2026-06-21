import api from './client';

export interface NseStock {
  symbol: string;
  displaySymbol: string;
  companyName: string;
}

export interface PortfolioItem {
  id: number;
  symbol: string;
  displaySymbol: string;
  companyName: string;
  quantity: number;
  buyingPrice: number;
  totalInvestment: number;
  createdAt: string;
  updatedAt: string;
}

export interface AddStockPayload {
  symbol: string;
  quantity: number;
  buyingPrice: number;
}

export const getStocks = () =>
  api.get<NseStock[]>('/api/portfolio/stocks');

export const getPortfolio = () =>
  api.get<PortfolioItem[]>('/api/portfolio');

export const addStock = (data: AddStockPayload) =>
  api.post<PortfolioItem>('/api/portfolio/add', data);

export const updateStock = (symbol: string, data: AddStockPayload) =>
  api.put<PortfolioItem>(`/api/portfolio/${symbol}`, data);

export const deleteStock = (symbol: string) =>
  api.delete(`/api/portfolio/${symbol}`);

export interface HoldingValuation {
  symbol: string;
  displaySymbol: string;
  companyName: string;
  quantity: number;
  buyingPrice: number;
  investmentValue: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  plPercent: number;
  gain: boolean;
  marketState: string;
}

export interface PortfolioValuation {
  holdings: HoldingValuation[];
  totalHoldings: number;
  totalInvestment: number;
  totalCurrentValue: number;
  totalProfitLoss: number;
  totalPLPercent: number;
  dataStatus: string;
  valuedAt: string;
}

export const getValuation = () =>
  api.get<PortfolioValuation>('/api/portfolio/valuation');

export interface PortfolioEntry {
  symbol: string;
  displaySymbol: string;
  companyName: string;
  quantity: number;
  buyingPrice: number;
}

export interface PortfolioUpdateItem {
  symbol: string;
  displaySymbol: string;
  companyName: string;
  currentQuantity: number;
  currentBuyingPrice: number;
  newQuantity: number;
  newBuyingPrice: number;
  changeDescription: string;
}

export interface PortfolioUploadPreview {
  newStocks: PortfolioEntry[];
  stocksToUpdate: PortfolioUpdateItem[];
  invalidSymbols: string[];
  parseErrors: string[];
  userMessage: string;
  requiresConfirmation: boolean;
}

export interface PortfolioConfirmRequest {
  toAdd: PortfolioEntry[];
  toUpdate: PortfolioEntry[];
}

export interface PortfolioConfirmResponse {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  message: string;
}

export const uploadPortfolio = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<PortfolioUploadPreview>('/api/portfolio/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const confirmUpload = (data: PortfolioConfirmRequest) =>
  api.post<PortfolioConfirmResponse>('/api/portfolio/confirm', data);
