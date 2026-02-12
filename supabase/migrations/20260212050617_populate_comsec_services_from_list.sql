/*
  # Populate ComSec Services from Master List

  1. Purpose
    - Add comprehensive list of ComSec services with pricing
    - Include cost/revenue categorization for each service
    - Based on standard company secretarial service offerings

  2. Services Added
    - Accounting, auditing, and taxation services
    - Company registration and maintenance services
    - Government fees and statutory filings
    - Document preparation and filing services
    - Virtual office and business support services

  3. Security
    - No RLS changes (uses existing policies)
*/

-- Insert all ComSec services with proper categorization
INSERT INTO comsec_services (service_name, service_type, price, cost_revenue_type, is_active)
VALUES
  ('Accounting, Auditing and Taxation Arrangement Service', 'accounting_auditing_taxation', 0, 'Revenue', true),
  ('Allotment of Share Service', 'allotment_of_share', 2000, 'Revenue', true),
  ('Annual Return Filing Service', 'annual_return_filing', 700, 'Revenue', true),
  ('BVI Government Fee', 'bvi_government_fee', 0, 'Revenue (incl. cost)', true),
  ('BVI Incorporation', 'bvi_incorporation', 0, 'Revenue (incl. cost)', true),
  ('BVI Maintenance', 'bvi_maintenance', 0, 'Revenue (incl. cost)', true),
  ('BVI Professional fees for ROM & ROBO', 'bvi_professional_fees', 0, 'Revenue (incl. cost)', true),
  ('Bank charge', 'bank_charge', 0, 'Cost', true),
  ('Business Registration Renewal Service', 'business_registration_renewal', 500, 'Revenue', true),
  ('Certified True Copy Service by Chartered Secretary [Per 5 Pages]', 'certified_true_copy', 500, 'Revenue', true),
  ('Cessation of Business Registration Certificate', 'cessation_business_registration', 500, 'Revenue', true),
  ('Change of Business Nature Service', 'change_business_nature', 500, 'Revenue', true),
  ('Change of Company Name Service', 'change_company_name', 1500, 'Revenue', true),
  ('Change of Company Particulars', 'change_company_particulars', 500, 'Revenue', true),
  ('Change of Director''s Particulars', 'change_director_particulars', 500, 'Revenue', true),
  ('Change of Registered Address Service', 'change_registered_address', 1000, 'Revenue', true),
  ('Change of Trade Name Service', 'change_trade_name', 500, 'Revenue', true),
  ('Change of Director / Company Secretary - Appointment [Per Individual or Entity]', 'change_director_secretary_appointment', 500, 'Revenue', true),
  ('Change of Director / Company Secretary - Resignation [Per Individual or Entity]', 'change_director_secretary_resignation', 500, 'Revenue', true),
  ('Company Secretarial Service - Acting as Company Secretary (one year)', 'company_secretary_one_year', 2500, 'Revenue', true),
  ('Company Secretarial Service - Hong Kong Limited Company Incorporation', 'company_secretary_hk_incorporation', 2300, 'Revenue', true),
  ('Company Secretarial Service - Hong Kong Unlimited Company Registration', 'company_secretary_hk_unlimited', 800, 'Revenue', true),
  ('Company Secretarial Service - Virtual Office (Lai Chi Kok) (one year)', 'virtual_office_lai_chi_kok', 2388, 'Revenue', true),
  ('Company Secretarial Service - Bank Account Opening', 'bank_account_opening', 8000, 'Revenue', true),
  ('Company Secretary Service - Others', 'company_secretary_others', 0, 'Revenue', true),
  ('Company Secretary Service - Transfer of Share Service [Per Transaction]', 'transfer_of_share', 2000, 'Revenue', true),
  ('Company chop and seal bundle', 'chop_seal_bundle', 500, 'Revenue (incl. cost)', true),
  ('Company chop order (1 set 2 chops)', 'chop_order_2', 300, 'Revenue (incl. cost)', true),
  ('Company seal order (1 seal)', 'seal_order_1', 300, 'Revenue (incl. cost)', true),
  ('Company Kit', 'company_kit', 800, 'Revenue (incl. cost)', true),
  ('Credit Card Processing Fee', 'credit_card_processing', 0, 'Cost', true),
  ('Declaration of Dormant Status', 'declaration_dormant', 1500, 'Revenue', true),
  ('Declaration of Cancellation of Dormant Status', 'cancellation_dormant', 1500, 'Revenue', true),
  ('Delivery charges', 'delivery_charges', 0, 'Revenue (incl. cost)', true),
  ('Deregistration Service', 'deregistration_service', 4500, 'Revenue', true),
  ('Deregistration Service Cancellation Service', 'deregistration_cancellation', 1000, 'Revenue', true),
  ('Designated Representative Service', 'designated_representative', 500, 'Revenue', true),
  ('Employer''s Return Filing Service', 'employer_return_filing', 500, 'Revenue', true),
  ('Employer''s Return Filing Service [HK$300/Employee]', 'employer_return_filing_per_employee', 300, 'Revenue', true),
  ('Government Fee - Others', 'government_fee_others', 0, 'Cost', true),
  ('Government Fee - Annual Return', 'government_fee_annual_return', 105, 'Cost', true),
  ('Government Fee - Business Registration Certificate', 'government_fee_br_certificate', 2200, 'Cost', true),
  ('Government Fee - Certificate of Incorporation (e-filing)', 'government_fee_ci_efiling', 1545, 'Cost', true),
  ('Government Fee - Certificate of Incorporation (paper filing)', 'government_fee_ci_paper', 1720, 'Cost', true),
  ('Government Fee - Change of Company Name', 'government_fee_change_name', 295, 'Cost', true),
  ('Government Fee - Deregistration', 'government_fee_deregistration', 690, 'Cost', true),
  ('Government Fee - Penalty', 'government_fee_penalty', 2500, 'Cost', true),
  ('Government Fee - Stamp Duty', 'government_fee_stamp_duty', 100, 'Cost', true),
  ('Green Box (Upgrade with Common Seal)', 'green_box_upgrade', 800, 'Revenue (incl. cost)', true),
  ('Prepare Letter to Inland Revenue Department', 'letter_ird', 500, 'Revenue', true),
  ('Prepayment', 'prepayment', 0, 'Prepayment', true),
  ('Profit Tax Return Filing Service', 'profit_tax_return_filing', 800, 'Revenue', true),
  ('Preparation of Notary Documents by a Solicitor', 'notary_documents_solicitor', 0, 'Revenue (incl. cost)', true),
  ('Representative of Attending Court Summons', 'court_summons_attendance', 2000, 'Revenue', true),
  ('Resolution preparation', 'resolution_preparation', 1000, 'Revenue', true),
  ('Registers Preparation (per document)', 'registers_preparation', 500, 'Revenue', true),
  ('Registers Update (per document)', 'registers_update', 250, 'Revenue', true),
  ('Storage Fee (after 21 days) per letter per week', 'storage_fee', 8, 'Revenue', true)
ON CONFLICT (service_type) 
DO UPDATE SET
  service_name = EXCLUDED.service_name,
  price = EXCLUDED.price,
  cost_revenue_type = EXCLUDED.cost_revenue_type,
  is_active = EXCLUDED.is_active;
