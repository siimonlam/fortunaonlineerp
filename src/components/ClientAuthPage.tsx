import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, User, Mail, Phone, Briefcase, Lock, AlertCircle, LogIn, UserPlus } from 'lucide-react';

interface ClientAuthPageProps {
  onAuthenticated: () => void;
}

export function ClientAuthPage({ onAuthenticated }: ClientAuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    industry: '',
    password: '',
    confirmPassword: ''
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData({
      ...registerData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: clientData, error: clientError } = await supabase
          .from('funding_clients')
          .select('is_approved')
          .eq('id', data.user.id)
          .maybeSingle();

        if (clientError) throw clientError;

        if (!clientData) {
          await supabase.auth.signOut();
          throw new Error('Account not found. Please register first.');
        }

        if (!clientData.is_approved) {
          await supabase.auth.signOut();
          throw new Error('Your account is pending approval. Please contact our team.');
        }

        onAuthenticated();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: insertError } = await supabase
          .from('funding_clients')
          .insert({
            id: authData.user.id,
            company_name: registerData.company_name,
            contact_name: registerData.contact_name,
            email: registerData.email,
            phone: registerData.phone,
            industry: registerData.industry,
            is_approved: false
          });

        if (insertError) throw insertError;

        setMessage('Registration successful! Your account is pending approval. You will be notified once approved.');
        setRegisterData({
          company_name: '',
          contact_name: '',
          email: '',
          phone: '',
          industry: '',
          password: '',
          confirmPassword: ''
        });

        setTimeout(() => {
          setIsLogin(true);
          setMessage('');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <h1 className="text-2xl font-bold mb-1">
            {isLogin ? 'Client Login' : 'Client Registration'}
          </h1>
          <p className="text-blue-100 text-sm">
            {isLogin
              ? 'Access your project information'
              : 'Register to access the client portal'}
          </p>
        </div>

        <div className="p-6">
          {error && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {message && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="your.email@company.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Building2 className="w-4 h-4" />
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={registerData.company_name}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your company name"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <User className="w-4 h-4" />
                  Contact Name
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={registerData.contact_name}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="your.email@company.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={registerData.phone}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Briefcase className="w-4 h-4" />
                  Industry
                </label>
                <input
                  type="text"
                  name="industry"
                  value={registerData.industry}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Technology, Healthcare"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Create a password (min 6 characters)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Registering...' : 'Register'}
              </button>

              <p className="text-xs text-slate-500 text-center">
                By registering, you agree to be contacted by our team.
              </p>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setMessage('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {isLogin
                ? "Don't have an account? Register here"
                : 'Already have an account? Login here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
