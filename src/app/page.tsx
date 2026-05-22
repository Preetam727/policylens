'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  UploadCloud, 
  FileText, 
  FileImage, 
  Shield, 
  ShieldAlert, 
  DollarSign, 
  AlertOctagon, 
  Calendar, 
  ArrowLeft, 
  ExternalLink, 
  Plus, 
  Search, 
  CheckCircle2, 
  Building2, 
  Sparkles, 
  Layers, 
  Loader2,
  Trash2,
  Send,
  MessageSquare,
  LogIn,
  LogOut,
  User,
  Lock,
  Mail,
  ArrowRight,
  GitCompare
} from 'lucide-react';

interface Policy {
  id: string;
  file_name: string;
  file_url: string;
  insurer_name: string;
  policy_type: string;
  created_at: string;
}

interface CoverageItem {
  item: string;
  description: string;
}

interface ExclusionItem {
  item: string;
  risk_level: 'high' | 'medium' | 'low';
  description: string;
}

interface LimitItem {
  item: string;
  amount: string;
  notes: string;
}

interface RedFlagItem {
  flag: string;
  severity: 'high' | 'medium';
  explanation: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Report {
  id: string;
  policy_id: string;
  snapshot: { summary: string };
  coverages: { coverages: CoverageItem[] };
  exclusions: { exclusions: ExclusionItem[] };
  limits: { limits: LimitItem[] };
  red_flags: { red_flags: RedFlagItem[] };
  status: string;
  created_at: string;
}

const STEPS = [
  'Uploading document to Supabase storage...',
  'Extracting text content & running OCR...',
  'Running 4 parallel Claude analysis agents...',
  'Synthesizing agent results & summarization...',
  'Saving report & rendering dashboard...'
];

export default function PolicyLensApp() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'coverage' | 'exclusions' | 'limits' | 'red_flags' | 'chat'>('all');
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>({});
  const [chatInputValue, setChatInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Auth states
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Comparison states
  const [comparePolicyIds, setComparePolicyIds] = useState<string[]>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareReports, setCompareReports] = useState<Record<string, Report>>({});
  const [activeCompareTab, setActiveCompareTab] = useState<'summary' | 'coverages' | 'exclusions' | 'limits' | 'red_flags'>('summary');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Listen for Auth changes and check session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchPolicies(activeUser);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchPolicies(activeUser);
      } else {
        setPolicies([]);
        setSelectedPolicy(null);
        setSelectedReport(null);
        setComparePolicyIds([]);
        setIsCompareMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch comparison reports when selection changes
  useEffect(() => {
    if (comparePolicyIds.length > 0) {
      fetchCompareReports(comparePolicyIds);
    }
  }, [comparePolicyIds]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistories, activeTab]);

  const fetchPolicies = async (currentUser?: any) => {
    const activeUser = currentUser || user;
    if (!activeUser) return;
    try {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('user_id', activeUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (err: any) {
      console.error('Error fetching policies:', err.message);
    }
  };

  const fetchCompareReports = async (ids: string[]) => {
    try {
      const missingIds = ids.filter(id => !compareReports[id]);
      if (missingIds.length === 0) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .in('policy_id', missingIds);

      if (error) throw error;

      if (data) {
        setCompareReports(prev => {
          const updated = { ...prev };
          data.forEach((r: Report) => {
            updated[r.policy_id] = r;
          });
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Error fetching comparison reports:', err.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        await fetchPolicies(data.user);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setAuthSuccessMsg('Account created! Please check your email for the confirmation link.');
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during registration.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleToggleCompare = (policyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setComparePolicyIds(prev => {
      if (prev.includes(policyId)) {
        const next = prev.filter(id => id !== policyId);
        if (next.length === 0) setIsCompareMode(false);
        return next;
      } else {
        if (prev.length >= 3) {
          alert('You can compare up to 3 policies at once.');
          return prev;
        }
        return [...prev, policyId];
      }
    });
  };

  const loadReport = async (policy: Policy) => {
    try {
      setSelectedPolicy(policy);
      setSelectedReport(null);
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('policy_id', policy.id)
        .single();

      if (error) throw error;
      setSelectedReport(data);
      setActiveTab('all');

      // Initialize chat history for this policy if it doesn't exist
      setChatHistories(prev => {
        if (prev[policy.id]) return prev;
        return {
          ...prev,
          [policy.id]: [
            {
              role: 'assistant',
              content: `Hello! I'm your PolicyLens AI Assistant. I've parsed your ${policy.insurer_name} (${policy.policy_type}) document and am ready to answer any specific questions. Ask me about what is covered, deductibles, exclusions, or any hidden clauses!`
            }
          ]
        };
      });
    } catch (err: any) {
      console.error('Error loading report:', err.message);
      setUploadError('Failed to load report for this policy.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file: File) => {
    setUploadError(null);
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const hasValidExt = /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    
    if (validTypes.includes(file.type) || hasValidExt) {
      setUploadFile(file);
      triggerUpload(file);
    } else {
      setUploadError('Invalid file type. Please upload a PDF or an image (PNG, JPEG, WebP).');
    }
  };

  const triggerUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStep(0);
    setUploadError(null);

    // Simulate progress through the extraction steps
    const stepIntervals = [1200, 3000, 7000, 4000]; // durations for visual feedback
    const advanceStep = (step: number) => {
      if (step < STEPS.length - 1) {
        setTimeout(() => {
          setUploadStep(step + 1);
          advanceStep(step + 1);
        }, stepIntervals[step]);
      }
    };
    advanceStep(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user) {
        formData.append('userId', user.id);
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze policy');
      }

      setUploadStep(STEPS.length - 1);
      
      // Refresh policy list
      await fetchPolicies();
      
      // Load the newly generated report
      setSelectedPolicy(data.policy);
      setSelectedReport(data.report);
      setActiveTab('all');

      // Initialize chat history for the newly uploaded policy
      const newPolicyId = data.policy.id;
      setChatHistories(prev => ({
        ...prev,
        [newPolicyId]: [
          {
            role: 'assistant',
            content: `Hello! I'm your PolicyLens AI Assistant. I've parsed your ${data.policy.insurer_name} (${data.policy.policy_type}) document and am ready to answer any specific questions. Ask me about what is covered, deductibles, exclusions, or any hidden clauses!`
          }
        ]
      }));
      
      // Close overlay
      setTimeout(() => {
        setIsUploading(false);
        setUploadFile(null);
      }, 800);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'An error occurred during policy analysis.');
    }
  };

  const handleDeletePolicy = async (e: React.MouseEvent, policyId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this policy and its report?')) return;

    try {
      // 1. Get policy file URL to delete from storage if needed
      const policyToDelete = policies.find(p => p.id === policyId);
      if (policyToDelete) {
        // Extract filepath from public URL
        const urlParts = policyToDelete.file_url.split('/policy-docs/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('policy-docs').remove([filePath]);
        }
      }

      // 2. Delete report
      await supabase.from('reports').delete().eq('policy_id', policyId);

      // 3. Delete policy
      const { error } = await supabase.from('policies').delete().eq('id', policyId);
      if (error) throw error;

      // 4. Update UI state
      setPolicies(policies.filter(p => p.id !== policyId));
      if (selectedPolicy?.id === policyId) {
        setSelectedPolicy(null);
        setSelectedReport(null);
      }
    } catch (err: any) {
      console.error('Error deleting policy:', err.message);
      alert('Failed to delete policy: ' + err.message);
    }
  };

  const handleViewOriginal = async (policy: Policy) => {
    try {
      const urlParts = policy.file_url.split('/policy-docs/');
      if (urlParts.length < 2) {
        window.open(policy.file_url, '_blank');
        return;
      }
      const storagePath = urlParts[1];
      const { data, error } = await supabase.storage
        .from('policy-docs')
        .createSignedUrl(storagePath, 300);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        window.open(policy.file_url, '_blank');
      }
    } catch (err: any) {
      console.error('Error generating signed URL:', err.message);
      window.open(policy.file_url, '_blank');
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy || !selectedReport || !chatInputValue.trim() || isChatLoading) return;

    const userMsg = chatInputValue.trim();
    setChatInputValue('');

    const currentPolicyId = selectedPolicy.id;
    const currentHistory = chatHistories[currentPolicyId] || [];

    const updatedHistory = [...currentHistory, { role: 'user' as const, content: userMsg }];
    setChatHistories(prev => ({
      ...prev,
      [currentPolicyId]: updatedHistory
    }));

    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report: selectedReport,
          messages: updatedHistory,
        }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to communicate with AI Assistant');
      }

      setChatHistories(prev => ({
        ...prev,
        [currentPolicyId]: [...updatedHistory, responseData.message]
      }));
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatHistories(prev => ({
        ...prev,
        [currentPolicyId]: [
          ...updatedHistory,
          {
            role: 'assistant' as const,
            content: `Sorry, I encountered an error while trying to process your question: "${err.message}". Please try again.`
          }
        ]
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  const filteredPolicies = policies.filter(p => {
    const term = searchQuery.toLowerCase();
    return (
      p.file_name.toLowerCase().includes(term) ||
      p.insurer_name.toLowerCase().includes(term) ||
      p.policy_type.toLowerCase().includes(term)
    );
  });

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f8fafc] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-50 pointer-events-none"></div>
        <div className="absolute top-1/4 left-1/4 -mt-20 -ml-20 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 -mb-20 -mr-20 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '10s' }}></div>

        <div className="w-full max-w-md p-8 rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-200/50 relative z-10 animate-fadeIn space-y-6 text-slate-800">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 mb-2">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight">
              Welcome to PolicyLens
            </h1>
            <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium">
              Securely analyze and compare your insurance policies in plain English.
            </p>
          </div>

          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(null); setAuthSuccessMsg(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-all ${
                authMode === 'signin'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthSuccessMsg(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-all ${
                authMode === 'signup'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs flex items-center space-x-2 font-medium">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-xs flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-200 disabled:to-slate-200 text-white disabled:text-slate-400 font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {authMode === 'signup' && (
            <div className="text-[9px] text-center text-slate-400 font-semibold tracking-wide">
              Note: Email confirmation is required by default. Check your inbox after sign up!
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-800 font-sans flex overflow-hidden">
      
      {/* 1. LEFT SIDEBAR: History / Policy List */}
      <aside className="w-80 border-r border-slate-200 bg-slate-50/80 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-none">
                PolicyLens
              </h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5 block">
                AI Policy Analyzer
              </span>
            </div>
          </div>
          
          {selectedPolicy && (
            <button 
              onClick={() => { setSelectedPolicy(null); setSelectedReport(null); }}
              className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all"
              title="Upload New Policy"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-slate-50/50">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
            Analysis History ({filteredPolicies.length})
          </div>
          
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-white/60">
              <p className="text-xs text-slate-400">No policies found.</p>
            </div>
          ) : (
            filteredPolicies.map((p) => {
              const isSelected = selectedPolicy?.id === p.id;
              const dateStr = new Date(p.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isCompareMode) {
                      handleToggleCompare(p.id, { stopPropagation: () => {} } as any);
                    } else {
                      loadReport(p);
                    }
                  }}
                  className={`group relative flex items-start space-x-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isSelected && !isCompareMode
                      ? 'bg-blue-50 border-blue-200 shadow-sm shadow-blue-500/5' 
                      : 'bg-white border-slate-200/80 hover:bg-slate-100/50 hover:border-slate-300'
                  }`}
                >
                  {/* Selection Checkbox for Comparison */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCompare(p.id, e);
                    }}
                    className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      comparePolicyIds.includes(p.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    {comparePolicyIds.includes(p.id) && (
                      <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected && !isCompareMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {p.file_name.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-4.5 h-4.5" />
                    ) : (
                      <FileImage className="w-4.5 h-4.5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-semibold text-xs truncate ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>
                        {p.insurer_name}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="text-[10px] text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded-md uppercase font-semibold">
                        {p.policy_type}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 truncate mt-1">
                      {p.file_name}
                    </p>
                    
                    <div className="flex items-center text-[10px] text-slate-400 mt-2">
                      <Calendar className="w-3 h-3 mr-1" />
                      {dateStr}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeletePolicy(e, p.id)}
                    className="absolute right-3.5 bottom-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-all duration-150"
                    title="Delete Policy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Compare Button */}
        {comparePolicyIds.length >= 2 && (
          <div className="p-4 border-t border-slate-200 bg-white shadow-lg animate-fadeIn shrink-0">
            <button
              type="button"
              onClick={() => setIsCompareMode(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 animate-pulse animate-fadeIn"
            >
              <GitCompare className="w-4 h-4" />
              <span>Compare Selected ({comparePolicyIds.length})</span>
            </button>
          </div>
        )}

        {/* User Profile Footer Widget */}
        {user && (
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-none">
                  Authenticated
                </p>
                <p className="text-[10px] text-slate-400 truncate mt-1 leading-none" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </aside>

      {/* 2. RIGHT WORKSPACE: Main Workspace / Dashboard */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
        
        {/* Active Dashboard Workspace */}
        {isCompareMode && comparePolicyIds.length >= 2 ? (
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50">
            {/* Header */}
            <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm relative z-10 shrink-0">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCompareMode(false)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center space-x-1.5"
                  title="Back to Details"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center">
                    <GitCompare className="w-4.5 h-4.5 mr-2 text-blue-600 animate-pulse" />
                    Policy Comparison
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Comparing {comparePolicyIds.length} policies side-by-side.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setComparePolicyIds([]);
                  setIsCompareMode(false);
                }}
                className="px-3.5 py-1.8 bg-white hover:bg-slate-50 text-xs font-semibold rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-rose-600 transition-all"
              >
                Clear Comparison
              </button>
            </div>

            {/* Comparison Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex space-x-4 shrink-0 overflow-x-auto scrollbar-none">
              {[
                { id: 'summary', label: 'Summary', icon: Sparkles },
                { id: 'coverages', label: 'Coverages', icon: Shield },
                { id: 'exclusions', label: 'Exclusions', icon: ShieldAlert },
                { id: 'limits', label: 'Limits & Deductibles', icon: DollarSign },
                { id: 'red_flags', label: 'Red Flags', icon: AlertOctagon }
              ].map(t => {
                const isTabActive = activeCompareTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveCompareTab(t.id as any)}
                    className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                      isTabActive
                        ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm shadow-blue-500/5'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Aligned Columns Grid Workspace */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 custom-scrollbar space-y-6">
              <div className={`grid gap-6 ${
                comparePolicyIds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}>
                {policies.filter(p => comparePolicyIds.includes(p.id)).map(policy => {
                  const report = compareReports[policy.id];
                  if (!report) {
                    return (
                      <div key={policy.id} className="p-8 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center space-y-3 shadow-sm min-h-[300px]">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <p className="text-xs font-medium text-slate-500 animate-pulse">Loading structured report...</p>
                      </div>
                    );
                  }

                  return (
                    <div key={policy.id} className="flex flex-col min-w-0 space-y-5">
                      {/* Header Card */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {policy.insurer_name}
                            </span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 shrink-0">
                              {policy.policy_type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 truncate" title={policy.file_name}>
                            File: {policy.file_name}
                          </p>
                        </div>
                      </div>

                      {/* Tab Content Display */}
                      {activeCompareTab === 'summary' && (
                        <div className="p-5 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white shadow-sm space-y-4 min-h-[200px]">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-600">Executive Snapshot</h4>
                          <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                            {report.snapshot?.summary || "No snapshot generated."}
                          </p>
                        </div>
                      )}

                      {activeCompareTab === 'coverages' && (
                        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Coverages ({report.coverages?.coverages?.length || 0})</h4>
                          <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {(report.coverages?.coverages || []).map((c, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{c.item}</p>
                                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{c.description}</p>
                                </div>
                              </div>
                            ))}
                            {(report.coverages?.coverages || []).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-4">No coverages extracted.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {activeCompareTab === 'exclusions' && (
                        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Exclusions ({report.exclusions?.exclusions?.length || 0})</h4>
                          <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {(report.exclusions?.exclusions || []).map((ex, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-xs font-bold uppercase ${
                                  ex.risk_level === 'high'
                                    ? 'bg-rose-100 text-rose-600'
                                    : ex.risk_level === 'medium'
                                      ? 'bg-amber-100 text-amber-600'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  !
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1.5">
                                    <p className="text-xs font-bold text-slate-800 truncate">{ex.item}</p>
                                    <span className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded-md shrink-0 ${
                                      ex.risk_level === 'high'
                                        ? 'bg-rose-100 text-rose-700'
                                        : ex.risk_level === 'medium'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-slate-200/80 text-slate-700'
                                    }`}>
                                      {ex.risk_level} Risk
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{ex.description}</p>
                                </div>
                              </div>
                            ))}
                            {(report.exclusions?.exclusions || []).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-4">No exclusions extracted.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {activeCompareTab === 'limits' && (
                        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Limits & Deductibles ({report.limits?.limits?.length || 0})</h4>
                          <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {(report.limits?.limits || []).map((lim, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="w-5 h-5 rounded bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm font-bold text-xs">
                                  $
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800 truncate">{lim.item}</p>
                                    <span className="text-xs font-extrabold text-cyan-700 shrink-0 ml-2">{lim.amount}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{lim.notes}</p>
                                </div>
                              </div>
                            ))}
                            {(report.limits?.limits || []).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-4">No limits extracted.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {activeCompareTab === 'red_flags' && (
                        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Red Flags ({report.red_flags?.red_flags?.length || 0})</h4>
                          <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {(report.red_flags?.red_flags || []).map((rf, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-xs font-bold ${
                                  rf.severity === 'high' ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-amber-100 text-amber-600'
                                }`}>
                                  ⚠️
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1.5">
                                    <p className="text-xs font-bold text-slate-800 truncate">{rf.flag}</p>
                                    <span className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded-md ${
                                      rf.severity === 'high'
                                        ? 'bg-rose-100 text-rose-700 font-bold'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {rf.severity}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{rf.explanation}</p>
                                </div>
                              </div>
                            ))}
                            {(report.red_flags?.red_flags || []).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-4">No red flags extracted.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : selectedPolicy ? (
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
            
            {/* Top Workspace Bar */}
            <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm shadow-slate-100/40 relative z-10">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => { setSelectedPolicy(null); setSelectedReport(null); }}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center space-x-1.5 md:hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-slate-900 flex items-center">
                      <Building2 className="w-4.5 h-4.5 mr-2 text-blue-600" />
                      {selectedPolicy.insurer_name}
                    </h2>
                    <span className="text-xs bg-blue-100 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      {selectedPolicy.policy_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm truncate mt-0.5">
                    Original File: <span className="font-semibold text-slate-600">{selectedPolicy.file_name}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleViewOriginal(selectedPolicy)}
                className="flex items-center space-x-1.5 px-3.5 py-1.8 bg-white hover:bg-slate-50 text-xs font-semibold rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
              >
                <span>View Original File</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Main Report Dashboard Content */}
            {selectedReport ? (
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6 custom-scrollbar bg-slate-50/50">
                
                {/* 1. Policy Snapshot (3-Sentence Executive Summary) */}
                <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/30 p-6 shadow-sm shadow-blue-100/50">
                  <div className="absolute right-0 top-0 -mt-10 -mr-10 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-start space-x-3.5 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                      <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                        Policy Snapshot
                      </h3>
                      <p className="text-slate-800 font-medium text-base leading-relaxed tracking-wide mt-2">
                        {selectedReport.snapshot?.summary || "No snapshot summary generated."}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 rounded-xl shadow-sm shadow-slate-100/40">
                  {[
                    { id: 'all', label: 'All Analysis', icon: Layers },
                    { id: 'coverage', label: 'Coverages', icon: Shield, color: 'text-emerald-600 border-emerald-500/50' },
                    { id: 'exclusions', label: 'Exclusions', icon: ShieldAlert, color: 'text-rose-600 border-rose-500/50' },
                    { id: 'limits', label: 'Limits & Deductibles', icon: DollarSign, color: 'text-cyan-600 border-cyan-500/50' },
                    { id: 'red_flags', label: 'Red Flags', icon: AlertOctagon, color: 'text-amber-600 border-amber-500/50' },
                    { id: 'chat', label: 'AI Assistant', icon: MessageSquare, color: 'text-blue-600 border-blue-500/50' }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs font-bold transition-all relative ${
                          isActive 
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? tab.color?.split(' ')[0] : 'text-slate-400'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dashboard Tab Panels */}
                <div className="space-y-6">
                  
                  {/* A. WHAT YOU'RE COVERED FOR */}
                  {(activeTab === 'all' || activeTab === 'coverage') && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-100/60">
                      <div className="px-5 py-4 bg-emerald-50/80 border-b border-emerald-100 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                          <Shield className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">What You're Covered For</h4>
                          <p className="text-[10px] text-slate-500">Explicit list of protections outlined in this policy</p>
                        </div>
                      </div>
                      
                      <div className="p-5 divide-y divide-slate-100">
                        {(!selectedReport.coverages?.coverages || selectedReport.coverages.coverages.length === 0) ? (
                          <p className="text-xs text-slate-500 py-4 text-center">No explicit coverages identified.</p>
                        ) : (
                          selectedReport.coverages.coverages.map((cov, idx) => (
                            <div key={idx} className="flex items-start space-x-3.5 py-4 first:pt-0 last:pb-0 animate-fadeIn">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <h5 className="text-xs font-bold text-slate-800">{cov.item}</h5>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cov.description}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* B. WHAT'S EXCLUDED */}
                  {(activeTab === 'all' || activeTab === 'exclusions') && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-100/60">
                      <div className="px-5 py-4 bg-rose-50/80 border-b border-rose-100 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                          <ShieldAlert className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">What's Excluded & Fine Print</h4>
                          <p className="text-[10px] text-slate-500">Exclusions, clauses, and fine print restricting protection</p>
                        </div>
                      </div>
                      
                      <div className="p-5 divide-y divide-slate-100">
                        {(!selectedReport.exclusions?.exclusions || selectedReport.exclusions.exclusions.length === 0) ? (
                          <p className="text-xs text-slate-500 py-4 text-center">No explicit exclusions identified.</p>
                        ) : (
                          selectedReport.exclusions.exclusions.map((ex, idx) => (
                            <div key={idx} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 animate-fadeIn">
                              <div className="flex items-start space-x-3.5 pr-4">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  ex.risk_level === 'high' ? 'bg-rose-600 animate-ping' : ex.risk_level === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                                }`} />
                                <div>
                                  <h5 className="text-xs font-bold text-slate-800">{ex.item}</h5>
                                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ex.description}</p>
                                </div>
                              </div>
                              <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                                ex.risk_level === 'high' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : ex.risk_level === 'medium' 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                  : 'bg-slate-50 text-slate-600 border border-slate-200'
                              }`}>
                                {ex.risk_level} Risk
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* C. LIMITS & DEDUCTIBLES */}
                  {(activeTab === 'all' || activeTab === 'limits') && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-100/60">
                      <div className="px-5 py-4 bg-cyan-50/80 border-b border-cyan-100 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600 shadow-sm">
                          <DollarSign className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Limits & Deductibles</h4>
                          <p className="text-[10px] text-slate-500">Policy limits, deductibles, caps, and out-of-pocket costs</p>
                        </div>
                      </div>
                      
                      <div className="p-5">
                        {(!selectedReport.limits?.limits || selectedReport.limits.limits.length === 0) ? (
                          <p className="text-xs text-slate-500 py-4 text-center">No limits or deductibles extracted.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedReport.limits.limits.map((lim, idx) => (
                              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between hover:shadow-sm transition-all duration-200 animate-fadeIn">
                                <div>
                                  <span className="text-[10px] text-cyan-600 font-extrabold uppercase tracking-wider block mb-1">
                                    Limit Details
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-800">{lim.item}</h5>
                                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{lim.notes}</p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-200/80 flex justify-between items-center">
                                  <span className="text-[11px] text-slate-500 font-medium">Maximum Limit / Excess</span>
                                  <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.8 rounded-lg border border-cyan-200/60">
                                    {lim.amount}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* D. RED FLAGS */}
                  {(activeTab === 'all' || activeTab === 'red_flags') && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-100/60">
                      <div className="px-5 py-4 bg-amber-50/80 border-b border-amber-100 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                          <AlertOctagon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Red Flags & Hidden Risks</h4>
                          <p className="text-[10px] text-slate-500">Ambiguous, restrictive, or unfavorable clauses to query</p>
                        </div>
                      </div>
                      
                      <div className="p-5 divide-y divide-slate-100">
                        {(!selectedReport.red_flags?.red_flags || selectedReport.red_flags.red_flags.length === 0) ? (
                          <div className="text-center py-6">
                            <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full font-semibold">
                              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" /> No high-severity red flags found.
                            </span>
                          </div>
                        ) : (
                          selectedReport.red_flags.red_flags.map((flag, idx) => (
                            <div key={idx} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 animate-fadeIn">
                              <div className="flex items-start space-x-3.5 pr-4">
                                <AlertOctagon className={`w-5 h-5 shrink-0 mt-0.5 ${
                                  flag.severity === 'high' ? 'text-rose-500 animate-pulse' : 'text-amber-500'
                                }`} />
                                <div>
                                  <h5 className="text-xs font-bold text-slate-800">{flag.flag}</h5>
                                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{flag.explanation}</p>
                                </div>
                              </div>
                              <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                                flag.severity === 'high' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {flag.severity} risk
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* E. AI CHAT ASSISTANT */}
                  {activeTab === 'chat' && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-100/60 flex flex-col h-[550px] animate-fadeIn">
                      {/* Chat Header */}
                      <div className="px-5 py-4 bg-blue-50/80 border-b border-blue-100 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                          <MessageSquare className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">PolicyLens AI Assistant</h4>
                          <p className="text-[10px] text-slate-500">Ask any questions about this specific insurance policy</p>
                        </div>
                      </div>
                      
                      {/* Message History */}
                      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 custom-scrollbar flex flex-col">
                        {(chatHistories[selectedPolicy.id] || []).map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div
                              key={idx}
                              className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                                  isUser
                                    ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/10'
                                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                                }`}
                              >
                                {!isUser && (
                                  <div className="flex items-center space-x-1.5 mb-1 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                                    <Sparkles className="w-3 h-3" />
                                    <span>PolicyLens AI</span>
                                  </div>
                                )}
                                <p className="whitespace-pre-line">{msg.content}</p>
                              </div>
                            </div>
                          );
                        })}
                        
                        {isChatLoading && (
                          <div className="flex justify-start animate-pulse">
                            <div className="max-w-[75%] rounded-2xl rounded-bl-none px-4 py-3 bg-white border border-slate-200 text-slate-500 text-xs flex items-center space-x-2 shadow-sm">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              <span>PolicyLens is thinking...</span>
                            </div>
                          </div>
                        )}
                        
                        <div ref={chatBottomRef} />
                      </div>
                      
                      {/* Message Input Form */}
                      <form
                        onSubmit={handleSendChatMessage}
                        className="p-4 border-t border-slate-200 bg-white flex items-center space-x-2.5"
                      >
                        <input
                          type="text"
                          value={chatInputValue}
                          onChange={(e) => setChatInputValue(e.target.value)}
                          placeholder="Ask about coverages, limits, deductibles, fine print..."
                          disabled={isChatLoading}
                          className="flex-1 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-xl py-3 px-4 text-xs text-slate-700 placeholder-slate-400 outline-none transition-all disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={!chatInputValue.trim() || isChatLoading}
                          className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 text-white disabled:text-slate-400 flex items-center justify-center shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50/40">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-sm text-slate-500 mt-4 font-semibold">Loading structured dashboard report...</p>
              </div>
            )}

          </div>
        ) : (
          
          /* Empty / Upload View */
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 custom-scrollbar relative bg-slate-50/40">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-50/30 via-slate-50/50 to-[#f8fafc] pointer-events-none"></div>

            <div className="w-full max-w-xl text-center space-y-8 relative z-10 animate-fadeIn">
              
              {/* Logo / Brand Header */}
              <div className="space-y-3.5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-2">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                  Demystify Your Insurance Policies
                </h2>
                <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                  Upload an insurance policy PDF or image. Our parallel multi-agent Claude pipeline extracts coverage, exclusions, limits, and red flags instantly.
                </p>
              </div>

              {/* Upload Card */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 rounded-2xl border border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center space-y-4 shadow-lg border-slate-200 bg-white hover:border-blue-500/50 hover:bg-slate-50/20 relative overflow-hidden group`}
              >
                {/* Glowing border decor on hover */}
                <div className="absolute inset-0 bg-blue-500/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500">
                  <UploadCloud className="w-6 h-6 animate-bounce" />
                </div>

                <div className="space-y-1 relative z-10">
                  <p className="font-bold text-sm text-slate-700 group-hover:text-slate-900 transition-all">
                    Drag and drop your policy file here
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports PDF documents or Images (PNG, JPEG, WebP) up to 25MB
                  </p>
                </div>

                <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all">
                  Browse Files
                </span>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                />
              </div>

              {/* Status & Help */}
              <div className="flex justify-center items-center space-x-6 text-[11px] text-slate-400 border-t border-slate-200 pt-6 max-w-sm mx-auto">
                <span className="flex items-center font-medium">
                  <Shield className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Encrypted & Private
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span className="flex items-center font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Claude 3.5 Sonnet Parallelized
                </span>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 3. FULL-SCREEN UPLOADING & PROCESSING OVERLAY */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-6 select-none animate-fadeIn backdrop-blur-sm">
          <div className="w-full max-w-md text-center space-y-6">
            
            {/* Spinning Indicator */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-blue-600/20 animate-ping absolute"></div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 relative">
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              </div>
            </div>

            {/* Document details */}
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Analyzing Policy...
              </h3>
              <p className="text-xs text-blue-600 font-bold truncate max-w-xs mx-auto">
                {uploadFile?.name}
              </p>
            </div>

            {/* Progress Pipeline Cards */}
            <div className="space-y-2 text-left bg-slate-50 border border-slate-200/80 rounded-xl p-5 shadow-lg">
              {STEPS.map((stepText, idx) => {
                const isDone = uploadStep > idx;
                const isCurrent = uploadStep === idx;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center space-x-3 text-xs py-1.5 transition-all duration-300 ${
                      isDone 
                        ? 'text-emerald-600' 
                        : isCurrent 
                        ? 'text-blue-600 font-bold scale-[1.01]' 
                        : 'text-slate-400'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] shrink-0 font-bold">
                        {idx + 1}
                      </div>
                    )}
                    <span className="truncate">{stepText}</span>
                  </div>
                );
              })}
            </div>

            {/* Upload Error Display inside overlay if occurred */}
            {uploadError && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl mt-4 text-center">
                <p className="font-bold text-sm">Analysis Failed</p>
                <p className="mt-1 text-[11px] leading-relaxed">{uploadError}</p>
                <button
                  onClick={() => {
                    setIsUploading(false);
                    setUploadError(null);
                    setUploadFile(null);
                  }}
                  className="mt-3.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-all shadow-md shadow-rose-200"
                >
                  Close & Retry
                </button>
              </div>
            )}

            <p className="text-[10px] text-slate-400 font-medium">
              Running 4 parallel Claude specialist models for deeper verification
            </p>

          </div>
        </div>
      )}

      {/* Global CSS Injectable animation properties */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

    </div>
  );
}
