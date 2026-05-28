export type TradeStatus = "open" | "closed";
export type TradeDirection = "long" | "short";

export interface TradeDTO {
  id: string;
  user_id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entry_time: string;
  entry_price: number;
  exit_time: string | null;
  exit_price: number | null;
  position_size: number;
  leverage: number;
  stop_loss: number | null;
  take_profit: number | null;
  fees: number;
  swaps: number;
  risk_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileDTO {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  strategy_name: string;
  balance: number;
  starting_balance: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentDTO {
  id: string;
  trade_id: string;
  author_id: string;
  text: string;
  created_at: string;
}

export interface BalanceEventDTO {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "reset" | "add" | "remove" | "adjust" | "trade";
  amount: number;
  note: string | null;
  created_at: string;
}
