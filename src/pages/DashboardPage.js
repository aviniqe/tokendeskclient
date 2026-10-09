import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getDeposits, getPayoutWallets, me } from '../services/api';
import { DashboardSkeleton } from '../components/Skeleton';
import { useRefresh } from '../hooks/useRefresh';

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [totalPercent, setTotalPercent] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([me(), getDeposits(), getPayoutWallets()])
      .then(([account, depositData, payoutData]) => {
        setProfile(account);
        setDeposits(depositData.deposits);
        setTotalPercent(Number(payoutData.totalPercent) || 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      const [account, depositData, payoutData] = await Promise.all([me(), getDeposits(), getPayoutWallets()]);
      setProfile(account);
      setDeposits(depositData.deposits);
      setTotalPercent(Number(payoutData.totalPercent) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  if (loading) return <DashboardSkeleton />;

  const settings = profile?.settings || {};
  const chargeRanges = Array.isArray(settings.chargeRanges) ? settings.chargeRanges : [];
  const ready = Math.abs(totalPercent - 100) < 0.0001;
  const received = deposits.reduce((sum, deposit) => sum + Number(deposit.receivedAmount || 0), 0);

  return (
    <motion.section className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {error && <p className="error">{error}</p>}
      <div className="stats">
        {[
          ['Charge balance', `${money(profile?.user?.balance)} USDT`],
          ['Charge ranges', chargeRanges.length ? String(chargeRanges.length) : 'None'],
          ['USDT received', `${money(received)} USDT`],
        ].map(([label, value], index) => (
          <motion.article key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </div>
      <div className="split">
        <article className="card">
          <header className="card__head">
            <h2>Payout split</h2>
            <span className={`pill ${ready ? 'is-ok' : 'is-warn'}`}>{totalPercent}% active</span>
          </header>
          <Link className="text-link" to="/payouts">Configure the split</Link>
        </article>
        <article className="card">
          <header className="card__head">
            <h2>Charge wallet</h2>
            <span className="pill">USDT</span>
          </header>
          {chargeRanges.length ? (
            <ul className="charge-list">
              {chargeRanges.map((row) => (
                <li key={`${row.min}-${row.max}-${row.percent}`}>
                  <span>{money(row.min)} – {money(row.max)} USDT</span>
                  <strong>{money(row.percent)}%</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted charge-note">No charge ranges are set.</p>
          )}
          <Link className="text-link" to="/wallet">Add charge balance</Link>
        </article>
      </div>
      <article className="card">
        <header className="card__head">
          <h2>Latest deposits</h2>
          <Link className="text-link" to="/reports">View reports</Link>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Address</th>
                <th>Status</th>
                <th>Received</th>
                <th>Charge</th>
              </tr>
            </thead>
            <tbody>
              {deposits.slice(0, 6).map((deposit, index) => (
                <tr key={deposit.id}>
                  <td className="col-num">{index + 1}</td>
                  <td className="mono">{deposit.address}</td>
                  <td><span className={`pill is-${deposit.status}`}>{deposit.status}</span></td>
                  <td>{money(deposit.receivedAmount)}</td>
                  <td>{money(deposit.chargeAmount)}</td>
                </tr>
              ))}
              {deposits.length === 0 && (
                <tr><td colSpan="5" className="muted">No deposit requests yet. Use the API to request an address.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </motion.section>
  );
}
