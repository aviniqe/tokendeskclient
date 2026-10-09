import { motion } from 'framer-motion';
import { HiOutlineTrash } from 'react-icons/hi2';
import { useEffect, useState } from 'react';
import Field from '../components/Field';
import RowMenu from '../components/RowMenu';
import Dialog from '../components/Dialog';
import SearchSelect from '../components/SearchSelect';
import { FormSkeleton, TableSkeleton } from '../components/Skeleton';
import { useForm } from '../hooks/useForm';
import { useRefresh } from '../hooks/useRefresh';
import { ethAddress, payoutLabel, percentShare } from '../lib/validators';
import { createPayoutWallet, deletePayoutWallet, getPayoutWallets, updatePayoutWallet } from '../services/api';

const ACTIVE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const emptyForm = { label: '', address: '', percent: '', active: true };
const rules = {
  label: payoutLabel(),
  address: ethAddress('Address'),
  percent: percentShare(),
};

export default function PayoutsPage() {
  const [wallets, setWallets] = useState([]);
  const [total, setTotal] = useState(0);
  const form = useForm(emptyForm, rules);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await getPayoutWallets();
    setWallets(data.wallets);
    setTotal(Number(data.totalPercent) || 0);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.validate()) return;
    setBusy(true);
    const body = {
      label: form.values.label.trim(),
      address: form.values.address.trim(),
      percent: Number(form.values.percent),
      active: form.values.active,
    };
    try {
      if (editing) await updatePayoutWallet(editing, body);
      else await createPayoutWallet(body);
      form.replace(emptyForm);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const ready = Math.abs(total - 100) < 0.0001;

  return (
    <motion.section className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <article className="card card__row">
        <div>
          <h2>Where USDT is sent</h2>
        </div>
        <span className={`pill ${ready ? 'is-ok' : 'is-warn'}`}>{total}% active</span>
      </article>
      {loading ? <FormSkeleton /> : (
        <form className="card form-grid" noValidate onSubmit={onSubmit}>
          <Field name="label" label="Label" error={form.error('label')}>
            <input
              value={form.values.label}
              onChange={(event) => form.setField('label', event.target.value)}
              onBlur={() => form.blur('label')}
              placeholder="Treasury wallet"
            />
          </Field>
          <Field name="address" label="Address" error={form.error('address')}>
            <input
              value={form.values.address}
              onChange={(event) => form.setField('address', event.target.value)}
              onBlur={() => form.blur('address')}
              placeholder="0x payout wallet address"
              spellCheck="false"
            />
          </Field>
          <Field name="percent" label="Percent" error={form.error('percent')}>
            <input
              inputMode="decimal"
              value={form.values.percent}
              onChange={(event) => form.setField('percent', event.target.value)}
              onBlur={() => form.blur('percent')}
              placeholder="40"
            />
          </Field>
          <Field name="active" label="Status">
            <SearchSelect
              value={form.values.active ? 'active' : 'inactive'}
              onChange={(value) => form.setField('active', value === 'active')}
              options={ACTIVE_OPTIONS}
              placeholder="Choose status"
              searchPlaceholder="Search status"
            />
          </Field>
          {form.summary && <p className="form-alert form-span" role="alert">{form.summary}</p>}
          {error && <p className="form-alert form-span" role="alert">{error}</p>}
          <div className="actions form-span">
            <button type="submit" className="primary" disabled={busy}>{editing ? 'Save address' : 'Add address'}</button>
            {editing && (
              <button type="button" className="ghost" onClick={() => { setEditing(null); form.replace(emptyForm); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {loading ? <TableSkeleton columns={5} rows={4} /> : (
        <article className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Label</th>
                  <th>Address</th>
                  <th>Percent</th>
                  <th>Active</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet, index) => (
                  <motion.tr key={wallet.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}>
                    <td className="col-num">{index + 1}</td>
                    <td>{wallet.label}</td>
                    <td className="mono">{wallet.address}</td>
                    <td>{wallet.percent}%</td>
                    <td>{wallet.active ? 'Yes' : 'No'}</td>
                    <td className="col-actions">
                      <RowMenu label="Payout actions">
                        {(close) => (
                          <>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => {
                                close();
                                setEditing(wallet.id);
                                form.replace({
                                  label: wallet.label,
                                  address: wallet.address,
                                  percent: String(wallet.percent ?? ''),
                                  active: Boolean(wallet.active),
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button type="button" className="danger" onClick={() => { close(); setConfirmId(wallet.id); }}>Delete</button>
                          </>
                        )}
                      </RowMenu>
                    </td>
                  </motion.tr>
                ))}
                {wallets.length === 0 && (
                  <tr>
                    <td colSpan="6" className="muted">No payout addresses yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
      <Dialog open={confirmId != null} title="Delete this payout address?" tone="danger" icon={HiOutlineTrash} onClose={() => setConfirmId(null)}>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setConfirmId(null)}>Cancel</button>
          <button
            type="button"
            className="danger"
            onClick={async () => {
              const id = confirmId;
              setConfirmId(null);
              await deletePayoutWallet(id);
              await load();
            }}
          >
            Delete
          </button>
        </div>
      </Dialog>
    </motion.section>
  );
}
