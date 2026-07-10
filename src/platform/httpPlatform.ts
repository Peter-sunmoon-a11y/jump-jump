import type { ActiveRound, GameSnapshot, PlayerProfile, RemoteGameConfig, RoundResult, WeeklyRankEntry } from '../game/types';
import type { PlatformAdapter, StartedRound } from './PlatformAdapter';
import { getDeviceId, getDeviceToken, setDeviceToken } from './deviceIdentity';

class HttpPlatformAdapter implements PlatformAdapter {
  private token: string | null = null;

  private async authenticate() {
    this.token ??= getDeviceToken();
    if (this.token) return;
    const response = await fetch('/api/identity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: await getDeviceId() }) });
    if (!response.ok) throw new Error('无法创建玩家身份');
    const result = await response.json() as { token: string };
    this.token = result.token; setDeviceToken(result.token);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    await this.authenticate();
    const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}`, ...init.headers } });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? '平台请求失败');
    return data;
  }

  getProfile() { return this.request<PlayerProfile>('/api/profile'); }
  getGameConfig() { return this.request<RemoteGameConfig>('/api/config'); }
  getWeeklyRanking() { return this.request<WeeklyRankEntry[]>('/api/ranking/weekly'); }
  recharge(amount: number) { return this.request<PlayerProfile>('/api/recharge', { method: 'POST', body: JSON.stringify({ amount }) }); }
  purchasePlays(count: number) { return this.request<PlayerProfile>('/api/plays/purchase', { method: 'POST', body: JSON.stringify({ count }) }); }
  getActiveRound() { return this.request<ActiveRound | null>('/api/active-round'); }
  startRound(practice = false) { return this.request<StartedRound>('/api/rounds', { method: 'POST', body: JSON.stringify({ practice }) }); }
  updateRound(roundId: string, snapshot: GameSnapshot) { return this.request<void>(`/api/rounds/${roundId}/snapshot`, { method: 'PUT', body: JSON.stringify({ snapshot }) }); }
  discardRound(roundId: string) { return this.request<void>(`/api/rounds/${roundId}`, { method: 'DELETE' }); }
  purchaseExtension(roundId: string, blocks: number) { return this.request<PlayerProfile>(`/api/rounds/${roundId}/extension`, { method: 'POST', body: JSON.stringify({ blocks }) }); }
  settle(result: RoundResult) { return this.request<PlayerProfile>(`/api/rounds/${result.roundId}/settle`, { method: 'POST', body: JSON.stringify(result) }); }
  getRecords() { return this.request<RoundResult[]>('/api/records'); }
}

export const httpPlatform = new HttpPlatformAdapter();
