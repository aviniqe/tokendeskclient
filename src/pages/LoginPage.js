import { motion } from 'framer-motion';
import { HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import Field from '../components/Field';
import { useForm } from '../hooks/useForm';
import { required } from '../lib/validators';
import { login, setToken } from '../services/api';
import { useState } from 'react';

const rules = {
  username: required('Username'),
  password: required('Password'),
};

export default function LoginPage({ onSuccess }) {
  const form = useForm({ username: '', password: '' }, rules);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.validate()) return;
    setBusy(true);
    try {
      const data = await login(form.values.username.trim(), form.values.password);
      setToken(data.token);
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <motion.section className="login__story" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
        <span className="brand__mark">TD</span>
        <h1>Token Desk</h1>
        <p>Keep a charge balance, set how incoming USDT is split, and request deposit addresses from your API.</p>
      </motion.section>
      <section className="login__panel">
        <motion.form noValidate onSubmit={onSubmit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
          <p className="kicker">Sign in</p>
          <h2>Open your account</h2>
          <Field name="username" label="Username" error={form.error('username')}>
            <input
              value={form.values.username}
              onChange={(event) => form.setField('username', event.target.value)}
              onBlur={() => form.blur('username')}
              placeholder="Enter your username"
              autoComplete="username"
            />
          </Field>
          <Field name="password" label="Password" error={form.error('password')}>
            <input
              type="password"
              value={form.values.password}
              onChange={(event) => form.setField('password', event.target.value)}
              onBlur={() => form.blur('password')}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </Field>
          {form.summary && <p className="form-alert" role="alert">{form.summary}</p>}
          {error && <p className="form-alert" role="alert">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            <HiOutlineArrowRightOnRectangle />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </motion.form>
      </section>
    </main>
  );
}
