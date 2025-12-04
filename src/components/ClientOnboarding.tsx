import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, User, Mail, Phone, Briefcase, CheckCircle, AlertCircle, MapPin, FileText, Scan } from 'lucide-react';
import { BusinessCardScanner } from './BusinessCardScanner';

export function ClientOnboarding() {
  const [formData, setFormData] = useState({
    company_name: '',
    company_name_chinese: '',
    brand_name: '',
    abbreviation: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    industry: '',
    other_industry: '',
    is_ecommerce: false,
    notes: '',
    sales_source: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const loadUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setFormData(prev => ({ ...prev, email: user.email || '' }));
      }
    };
    loadUserEmail();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData({
      ...formData,
      [name]: newValue
    });
  };

  const handleScanData = (scannedData: any) => {
    setFormData(prev => ({
      ...prev,
      ...(scannedData.company_name && { company_name: scannedData.company_name }),
      ...(scannedData.contact_name && { contact_name: scannedData.contact_name }),
      ...(scannedData.phone && { phone: scannedData.phone }),
      ...(scannedData.address && { address: scannedData.address }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await supabase.rpc('create_client_onboarding', {
        p_company_name: formData.company_name,
        p_contact_name: formData.contact_name,
        p_email: formData.email,
        p_phone: formData.phone,
        p_industry: formData.industry,
        p_company_name_chinese: formData.company_name_chinese || null,
        p_brand_name: formData.brand_name || null,
        p_abbreviation: formData.abbreviation || null,
        p_address: formData.address || null,
        p_other_industry: formData.industry === 'Other' ? formData.other_industry || null : null,
        p_is_ecommerce: formData.is_ecommerce,
        p_notes: formData.notes || null,
        p_sales_source: formData.sales_source || null
      });

      if (submitError) throw submitError;

      setSubmitted(true);
      setFormData({
        company_name: '',
        company_name_chinese: '',
        brand_name: '',
        abbreviation: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        industry: '',
        other_industry: '',
        is_ecommerce: false,
        notes: '',
        sales_source: ''
      });
    } catch (err: any) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h2>
          <p className="text-slate-600 mb-6">
            Your information has been successfully submitted. Our team will review your details and get back to you soon.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Welcome</h1>
          <p className="text-blue-100">Please provide your information to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
            >
              <Scan className="w-5 h-5" />
              Scan Business Card
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4" />
                Company Name *
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your company name"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4" />
                Abbreviation
              </label>
              <input
                type="text"
                name="abbreviation"
                value={formData.abbreviation}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter abbreviation"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4" />
                Company Name in Chinese
              </label>
              <input
                type="text"
                name="company_name_chinese"
                value={formData.company_name_chinese}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="输入中文公司名称"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4" />
                Brand Name
              </label>
              <input
                type="text"
                name="brand_name"
                value={formData.brand_name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter brand name"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <User className="w-4 h-4" />
              Contact Name *
            </label>
            <input
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Mail className="w-4 h-4" />
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled
              className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              placeholder="your.email@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Phone className="w-4 h-4" />
                Phone *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Briefcase className="w-4 h-4" />
                Sales Source
              </label>
              <select
                name="sales_source"
                value={formData.sales_source}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">-- Select Sales Source --</option>
                <option value="Direct">Direct</option>
                <option value="Referral">Referral</option>
                <option value="Website">Website</option>
                <option value="Social Media">Social Media</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Briefcase className="w-4 h-4" />
                Industry *
              </label>
              <select
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select an industry</option>
                <option value="Accounting">Accounting</option>
                <option value="Advertising & Marketing">Advertising & Marketing</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Automotive">Automotive</option>
                <option value="Aviation / Aerospace">Aviation / Aerospace</option>
                <option value="Banking & Financial Services">Banking & Financial Services</option>
                <option value="Biotechnology">Biotechnology</option>
                <option value="Construction">Construction</option>
                <option value="Consulting">Consulting</option>
                <option value="Consumer Goods / FMCG">Consumer Goods / FMCG</option>
                <option value="Education">Education</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Energy / Oil & Gas">Energy / Oil & Gas</option>
                <option value="Engineering">Engineering</option>
                <option value="Entertainment & Media">Entertainment & Media</option>
                <option value="Fashion & Apparel">Fashion & Apparel</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Government / Public Sector">Government / Public Sector</option>
                <option value="Healthcare / Medical">Healthcare / Medical</option>
                <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                <option value="Human Resources / Recruiting">Human Resources / Recruiting</option>
                <option value="Information Technology (IT)">Information Technology (IT)</option>
                <option value="Insurance">Insurance</option>
                <option value="Internet / Online Services">Internet / Online Services</option>
                <option value="Legal Services">Legal Services</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Retail">Retail</option>
                <option value="Software / SaaS">Software / SaaS</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Transportation">Transportation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Briefcase className="w-4 h-4" />
                E-commerce
              </label>
              <select
                name="is_ecommerce"
                value={formData.is_ecommerce ? 'yes' : 'no'}
                onChange={(e) => setFormData({ ...formData, is_ecommerce: e.target.value === 'yes' })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>

          {formData.industry === 'Other' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Briefcase className="w-4 h-4" />
                Specify Other Industry *
              </label>
              <input
                type="text"
                name="other_industry"
                value={formData.other_industry}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter industry name"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <MapPin className="w-4 h-4" />
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your address"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[80px]"
              placeholder="Enter additional notes or information"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            By submitting this form, you agree to be contacted by our team regarding your inquiry.
          </p>
        </form>
      </div>

      {showScanner && (
        <BusinessCardScanner
          onDataExtracted={handleScanData}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
