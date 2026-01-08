-- MODULE: REIMBURSEMENT
-- Description: Tables to handle employee expense claims (Reimbursement)

-- 1. Create Enum for Claim Types
CREATE TYPE public.reimbursement_type AS ENUM (
  'medical', 
  'transport', 
  'travel', 
  'meal', 
  'communication', 
  'other'
);

-- 2. Create Reimbursement Requests Table
CREATE TABLE IF NOT EXISTS public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Claim Details
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type public.reimbursement_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  
  -- Proof (File Upload URL from Storage)
  attachment_url TEXT,
  
  -- Approval Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, paid
  
  -- Audit Trail
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- A. Users can view their own requests
CREATE POLICY "Users can view own reimbursements" 
  ON public.reimbursements FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- B. Users can create requests
CREATE POLICY "Users can create reimbursements" 
  ON public.reimbursements FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- C. Users can update OWN pending requests only
CREATE POLICY "Users can update own pending reimbursements" 
  ON public.reimbursements FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid() AND status = 'pending');

-- D. Users can delete OWN pending requests only
CREATE POLICY "Users can delete own pending reimbursements" 
  ON public.reimbursements FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid() AND status = 'pending');

-- E. Admins & Managers can view ALL requests
CREATE POLICY "Admins and Managers can view all reimbursements" 
  ON public.reimbursements FOR SELECT 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'manager'));

-- F. Admins & Managers can update requests (Approve/Reject)
CREATE POLICY "Admins and Managers can manage reimbursements" 
  ON public.reimbursements FOR UPDATE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'manager'));

-- 5. Trigger for updated_at
CREATE TRIGGER update_reimbursements_updated_at 
  BEFORE UPDATE ON public.reimbursements 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
