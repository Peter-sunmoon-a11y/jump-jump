import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { PhaserGameHandle } from './game/PhaserGame';
import { calculateXp, EXTENSION_PRICES, MEDALS, medalForXp } from './game/rules';
import type { GameSnapshot, PlayerProfile, Quality, RewardHit, RoundResult, Screen, Settings, WeeklyRankEntry } from './game/types';
import { mockPlatform } from './platform/mockPlatform';
import { gameAudio } from './audio/gameAudio';

const SETTINGS_KEY = 'jump-star-settings-v1';
const defaultSettings: Settings = { quality: 'auto', music: true, sound: true, vibration: true, reducedMotion: false };
const PhaserGame = lazy(() => import('./game/PhaserGame'));

function readSettings(): Settings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '') }; } catch { return defaultSettings; }
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [settings, setSettings] = useState(readSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [practice, setPractice] = useState(false);
  const [round, setRound] = useState<{ roundId: string; seed: number; startedAt: number } | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ block: 0, rewards: [], stable: true, extending: false });
  const [toast, setToast] = useState('');
  const [extensionGate, setExtensionGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const gameRef = useRef<PhaserGameHandle>(null);
  const snapshotRef = useRef(snapshot);
  const endingRef = useRef(false);

  useEffect(() => {
    void (async () => {
      let loadedProfile = await mockPlatform.getProfile();
      const interrupted = await mockPlatform.getActiveRound();
      if (interrupted) {
        if (interrupted.practice) {
          await mockPlatform.discardRound(interrupted.roundId);
        } else {
          const baseUsdt = interrupted.snapshot.rewards.filter((item) => item.kind === 'usdt').reduce((sum, item) => sum + item.value, 0);
          const bonus = medalForXp(loadedProfile.xp).bonus;
          loadedProfile = await mockPlatform.settle({
            roundId: interrupted.roundId,
            block: interrupted.snapshot.block,
            reason: 'quit',
            rewards: interrupted.snapshot.rewards,
            baseUsdt: Number(baseUsdt.toFixed(2)),
            bonusUsdt: Number((baseUsdt * bonus).toFixed(2)),
            xpEarned: calculateXp(interrupted.snapshot.block, interrupted.snapshot.rewards),
            startedAt: interrupted.startedAt,
          });
          window.setTimeout(() => showToast('上一局已自动结束，奖励已完成补结算'), 250);
        }
      }
      setProfile(loadedProfile);
    })();
  }, []);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const medal = useMemo(() => medalForXp(profile?.xp ?? 0), [profile?.xp]);

  async function startGame(isPractice = false) {
    if (busy) return;
    setBusy(true);
    try {
      const started = await mockPlatform.startRound(isPractice);
      setProfile(started.profile);
      setPractice(isPractice);
      setRound({ roundId: started.roundId, seed: started.seed, startedAt: Date.now() });
      setSnapshot({ block: 0, rewards: [], stable: true, extending: false });
      snapshotRef.current = { block: 0, rewards: [], stable: true, extending: false };
      endingRef.current = false;
      setScreen('game');
      gameAudio.play('start', settings.sound);
    } catch (error) { showToast((error as Error).message); }
    finally { setBusy(false); }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 1900);
  }

  function onReward(reward: RewardHit) {
    gameAudio.play('reward', settings.sound);
    showToast(`✦ ${reward.label} 已锁定`);
    if (settings.vibration && navigator.vibrate) navigator.vibrate([18, 35, 24]);
  }

  function onSnapshot(next: GameSnapshot) {
    if (next.block > snapshotRef.current.block) gameAudio.play('land', settings.sound);
    snapshotRef.current = next;
    setSnapshot(next);
    if (round) void mockPlatform.updateRound(round.roundId, next).catch(() => showToast('局次同步暂时中断'));
    if (practice && next.block >= 8 && next.stable) void finishRound('completed');
  }

  async function finishRound(reason: RoundResult['reason']) {
    if (!round || endingRef.current) return;
    endingRef.current = true;
    if (reason === 'fell') gameAudio.play('fall', settings.sound);
    setExtensionGate(false);
    const current = gameRef.current?.snapshot() ?? snapshotRef.current;
    if (practice) {
      await mockPlatform.discardRound(round.roundId);
      setResult({ roundId: round.roundId, block: current.block, reason, rewards: [], baseUsdt: 0, bonusUsdt: 0, xpEarned: 0, startedAt: round.startedAt });
      setScreen('results');
      return;
    }
    setBusy(true);
    const baseUsdt = current.rewards.filter((item) => item.kind === 'usdt').reduce((sum, item) => sum + item.value, 0);
    const bonusUsdt = Number((baseUsdt * medal.bonus).toFixed(2));
    const settled: RoundResult = {
      roundId: round.roundId, block: current.block, reason, rewards: current.rewards,
      baseUsdt: Number(baseUsdt.toFixed(2)), bonusUsdt, xpEarned: calculateXp(current.block, current.rewards), startedAt: round.startedAt,
    };
    try {
      const nextProfile = await mockPlatform.settle(settled);
      setProfile(nextProfile);
      setResult(settled);
      setScreen('results');
      gameAudio.play('settle', settings.sound);
    } catch {
      endingRef.current = false;
      showToast('结算暂未完成，记录已保留，请重试');
    } finally { setBusy(false); }
  }

  async function buyExtension(blocks: number) {
    if (busy) return;
    setBusy(true);
    try {
      if (!round) throw new Error('局次已失效');
      const nextProfile = await mockPlatform.purchaseExtension(round.roundId, blocks);
      setProfile(nextProfile);
      setExtensionGate(false);
      gameRef.current?.extend(blocks);
      showToast(`已解锁 ${blocks} 格惊喜旅程`);
    } catch (error) { showToast(`${(error as Error).message}，请选择可用档位或充值`); }
    finally { setBusy(false); }
  }

  function returnHome() {
    setRound(null); setResult(null); setScreen('home'); setExtensionGate(false); endingRef.current = false;
  }

  if (!profile) return <div className="app-shell loading"><div className="pixel-loader">✦</div><p>正在点亮天空岛…</p></div>;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <main className="phone-stage">
        {screen === 'home' && <Home profile={profile} onStart={() => startGame(false)} onPractice={() => startGame(true)} onSettings={() => setSettingsOpen(true)} onRecharge={() => setRechargeOpen(true)} onRanking={() => setScreen('ranking')} onRecords={() => setScreen('records')} busy={busy} />}
        {screen === 'game' && round && (
          <section className="game-screen">
            <Suspense fallback={<div className="game-loading">正在搭建天空岛…</div>}>
              <PhaserGame ref={gameRef} seed={round.seed} practice={practice} quality={settings.quality} reducedMotion={settings.reducedMotion} onSnapshot={onSnapshot} onReward={onReward} onFell={() => finishRound('fell')} onExtensionGate={() => setExtensionGate(true)} />
            </Suspense>
            <div className="game-topbar">
              <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="设置">⚙</button>
              <div className="block-counter"><small>当前</small><strong>{snapshot.block}</strong><span>格</span></div>
              <div className="locked-reward"><small>已锁定</small><strong>{snapshot.rewards.filter((r) => r.kind === 'usdt').reduce((s, r) => s + r.value, 0).toFixed(2)}</strong><span>USDT</span></div>
            </div>
            {snapshot.stable && snapshot.block > 0 && <button className="cashout-button" onClick={() => finishRound('cashout')}>结束并结算</button>}
            {practice && <div className="practice-tag">练习模式 · {Math.min(snapshot.block, 8)}/8</div>}
          </section>
        )}
        {screen === 'results' && result && <Results result={result} practice={practice} medal={medal} onAgain={() => startGame(practice)} onHome={returnHome} busy={busy} />}
        {screen === 'ranking' && <Ranking profile={profile} onBack={() => setScreen('home')} />}
        {screen === 'records' && <Records onBack={() => setScreen('home')} />}

        {extensionGate && <ExtensionModal profile={profile} block={snapshot.block} onBuy={buyExtension} onFinish={() => finishRound(snapshot.block === 100 ? 'completed' : 'cashout')} busy={busy} />}
        {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />}
        {rechargeOpen && <RechargeModal balance={profile.balance} busy={busy} onClose={() => setRechargeOpen(false)} onRecharge={async (amount) => { setBusy(true); try { setProfile(await mockPlatform.recharge(amount)); setRechargeOpen(false); const gifted = Math.floor(amount / 5); showToast(`充值 ${amount.toFixed(2)} USDT 成功${gifted ? `，赠送 ${gifted} Play` : ''}`); } finally { setBusy(false); } }} />}
        {toast && <div className="toast">{toast}</div>}
        {busy && screen === 'game' && <div className="busy-dot">结算连接中…</div>}
      </main>
    </div>
  );
}

function Home({ profile, onStart, onPractice, onSettings, onRecharge, onRanking, onRecords, busy }: { profile: PlayerProfile; onStart(): void; onPractice(): void; onSettings(): void; onRecharge(): void; onRanking(): void; onRecords(): void; busy: boolean }) {
  const medal = medalForXp(profile.xp);
  const index = MEDALS.indexOf(medal);
  const next = MEDALS[index + 1];
  const progress = next ? (profile.xp - medal.minXp) / (next.minXp - medal.minXp) : 1;
  return <section className="home-screen">
    <header className="home-header">
      <div className="player"><div className="avatar">★</div><div><strong>{profile.name}</strong><small>{medal.name} · 奖励 +{medal.bonus * 100}%</small></div></div>
      <button className="icon-button" onClick={onSettings}>⚙</button>
    </header>
    <div className="balance-row"><div><span>PLAY</span><strong>▣ {profile.plays}</strong></div><div className="balance-box"><span>平台余额</span><strong>₮ {profile.balance.toFixed(2)}</strong><button onClick={onRecharge}>＋</button></div></div>
    <div className="hero-art"><div className="pixel-star s1">✦</div><div className="pixel-star s2">✦</div><div className="island back"/><div className="jumper"><i/><b>•&nbsp;•</b></div><div className="island front"><span>START</span></div></div>
    <div className="title-lockup"><p>治愈系像素跳跃</p><h1>跳跳之星</h1><span>每一次落地，都值得庆祝</span></div>
    <button className="primary-button" disabled={busy || profile.plays < 1} onClick={onStart}><span>{profile.plays ? '开始跳跃' : '获取 Play'}</span><small>{profile.plays ? '消耗 1 PLAY' : '当前次数不足'}</small></button>
    <button className="practice-button" onClick={onPractice}>第一次玩？免费练习</button>
    <div className="medal-card"><div className="medal-icon" style={{ color: medal.color }}>★</div><div><div className="medal-title"><strong>{medal.name}</strong><span>{profile.xp} XP</span></div><div className="progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }}/></div><small>{next ? `距离 ${next.name} 还差 ${next.minXp - profile.xp} XP` : '你已抵达星光之巅'}</small></div></div>
    <nav className="bottom-nav"><button onClick={onRecords}>▤<span>战绩</span></button><button className="active">◆<span>跳跃</span></button><button onClick={onRanking}>♛<span>周榜</span></button></nav>
  </section>;
}

function ExtensionModal({ profile, block, onBuy, onFinish, busy }: { profile: PlayerProfile; block: number; onBuy(n: number): void; onFinish(): void; busy: boolean }) {
  return <div className="modal-backdrop"><div className="extension-modal pixel-panel"><div className="modal-star">✦</div><p className="eyebrow">第 {block} 格稳定着陆</p><h2>前方出现了惊喜航线</h2><p>想继续探索吗？每 10 格都有神秘礼物。你也可以安心带走已获得的奖励。</p><div className="extension-balance">平台余额 <strong>{profile.balance.toFixed(2)} USDT</strong></div><div className="extension-grid">{Object.entries(EXTENSION_PRICES).map(([blocks, price]) => <button key={blocks} disabled={busy || profile.balance < price} onClick={() => onBuy(Number(blocks))}><strong>+{blocks} 格</strong><span>{price.toFixed(2)} USDT</span></button>)}</div><button className="primary-button compact" disabled={busy} onClick={onFinish}>就到这里，结算奖励</button><small className="gentle-copy">继续与否都很棒，选择让你舒服的节奏</small></div></div>;
}

function Results({ result, practice, medal, onAgain, onHome, busy }: { result: RoundResult; practice: boolean; medal: ReturnType<typeof medalForXp>; onAgain(): void; onHome(): void; busy: boolean }) {
  const total = result.baseUsdt + result.bonusUsdt;
  return <section className="results-screen"><div className="celebrate">✦ <span>✦</span> ✦</div><p className="eyebrow">{practice ? '练习完成' : result.reason === 'fell' ? '这次也跳得很漂亮' : '奖励已安全抵达'}</p><h1>{practice ? '手感已经热起来了！' : `+${total.toFixed(2)} USDT`}</h1><div className="result-hero">★</div><div className="result-stats"><div><strong>{result.block}</strong><span>到达方块</span></div><div><strong>{result.rewards.length}</strong><span>奖励节点</span></div><div><strong>+{result.xpEarned}</strong><span>勋章经验</span></div></div>{!practice && <div className="settlement-lines"><div><span>基础奖励</span><strong>{result.baseUsdt.toFixed(2)} USDT</strong></div><div><span>{medal.name}加成</span><strong>+{result.bonusUsdt.toFixed(2)} USDT</strong></div></div>}<button className="primary-button" disabled={busy} onClick={onAgain}>{practice ? '开始正式挑战' : '再跳一局'}<small>{practice ? '将消耗 1 PLAY' : '保持好手感'}</small></button><button className="text-button" onClick={onHome}>返回天空岛</button></section>;
}

function Ranking({ profile, onBack }: { profile: PlayerProfile; onBack(): void }) {
  const [rows, setRows] = useState<WeeklyRankEntry[]>([]);
  useEffect(() => { void mockPlatform.getWeeklyRanking().then(setRows); }, [profile.totalReward]);
  return <section className="sub-screen"><SubHeader title="本周奖励榜" onBack={onBack}/><p className="sub-copy">周一 00:00 重置 · 已结算 USDT</p><div className="podium">♛</div><div className="rank-list">{rows.map((row) => <div className={row.isCurrentUser ? 'me' : ''} key={row.playerName}><b>{row.rank}</b><span>{row.playerName}</span><strong>{row.reward.toFixed(2)} USDT</strong></div>)}</div></section>;
}

function RechargeModal({ balance, busy, onClose, onRecharge }: { balance: number; busy: boolean; onClose(): void; onRecharge(amount: number): void }) {
  return <div className="modal-backdrop"><div className="pixel-panel recharge-modal"><div className="modal-head"><h2>模拟平台充值</h2><button className="icon-button" onClick={onClose}>×</button></div><p>当前余额 <strong>{balance.toFixed(2)} USDT</strong></p><div className="recharge-offer">每充值满 5 USDT，赠送 1 Play</div><div className="recharge-grid">{[1, 5, 10, 20].map((amount) => <button disabled={busy} key={amount} onClick={() => onRecharge(amount)}><b>+{amount}</b><span>USDT{amount >= 5 ? ` · 赠 ${Math.floor(amount / 5)} Play` : ''}</span></button>)}</div><small>演示环境不会产生真实扣款</small></div></div>;
}

function Records({ onBack }: { onBack(): void }) {
  const records = mockPlatform.getRecords();
  return <section className="sub-screen"><SubHeader title="我的战绩" onBack={onBack}/><p className="sub-copy">每一次勇敢起跳，都有迹可循</p><div className="record-list">{records.length === 0 ? <div className="empty">还没有战绩<br/><small>去完成第一场跳跃吧</small></div> : records.map((item) => <div key={item.roundId}><div><strong>抵达第 {item.block} 格</strong><small>{new Date(item.startedAt).toLocaleString('zh-CN')}</small></div><b>+{(item.baseUsdt + item.bonusUsdt).toFixed(2)} USDT</b></div>)}</div></section>;
}

function SubHeader({ title, onBack }: { title: string; onBack(): void }) { return <header className="sub-header"><button className="icon-button" onClick={onBack}>←</button><h2>{title}</h2><i/></header>; }

function SettingsModal({ settings, onChange, onClose }: { settings: Settings; onChange(s: Settings): void; onClose(): void }) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  return <div className="modal-backdrop"><div className="settings-modal pixel-panel"><div className="modal-head"><h2>游戏设置</h2><button className="icon-button" onClick={onClose}>×</button></div><label>性能模式</label><div className="quality-options">{(['auto', 'smooth', 'balanced', 'high'] as Quality[]).map((q) => <button className={settings.quality === q ? 'selected' : ''} key={q} onClick={() => update('quality', q)}>{{ auto: '自动', smooth: '流畅', balanced: '均衡', high: '高画质' }[q]}</button>)}</div>{([['music', '背景音乐'], ['sound', '游戏音效'], ['vibration', '触感震动'], ['reducedMotion', '减少动态效果']] as const).map(([key, label]) => <div className="toggle-row" key={key}><span>{label}</span><button className={settings[key] ? 'on' : ''} onClick={() => update(key, !settings[key])}><i/></button></div>)}<p>性能设置只影响画面表现，不影响跳跃手感、方块位置与奖励结果。</p><button className="primary-button compact" onClick={onClose}>保存并返回</button></div></div>;
}
