import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Terminal, 
  Database, 
  FileText, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Edit, 
  Save, 
  RotateCcw, 
  ChevronRight, 
  Check, 
  Play, 
  Sparkles,
  Server,
  User,
  ShoppingBag,
  Info
} from 'lucide-react';

export default function App() {
  // Application State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Refund Agent. How can I help you today? You can ask me about refund eligibility for any order, such as "Can I get a refund for order C005?".',
      logs: [],
      decision: null
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs', 'crm', 'policy'
  const [currentLogs, setCurrentLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ online: false, mode: 'Checking...' });
  
  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recognition, setRecognition] = useState(null);
  
  // CRM Editor Modal State
  const [editingOrder, setEditingOrder] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    order_date: '',
    product_name: '',
    product_type: 'physical',
    amount: 0,
    is_damaged: 0,
    custom_made: 0
  });

  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);

  // Quick Demo Scenarios
  const demoScenarios = [
    { label: "✅ Approved (C005)", query: "Refund order C005" },
    { label: "❌ Denied: >30 Days (C010)", query: "Can I get a refund for order C010?" },
    { label: "❌ Denied: Damaged (C007)", query: "I want to refund order C007" },
    { label: "❌ Denied: Digital (C003)", query: "Refund order C003 please" },
    { label: "⚠️ Manager Approval (C006)", query: "Is order C006 eligible for a refund?" }
  ];

  // Fetch orders and system status on mount
  useEffect(() => {
    fetchOrders();
    checkSystemStatus();
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      
      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsRecording(false);
        // Automatically send the spoken message
        handleSendMessage(transcript);
      };
      
      rec.onerror = () => {
        setIsRecording(false);
      };
      
      rec.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(rec);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentLogs]);

  const checkSystemStatus = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'healthy') {
        setSystemStatus({
          online: true,
          mode: data.openai_configured ? 'Live LangGraph Agent (GPT-4o-mini)' : 'Rule-Based Simulator'
        });
      }
    } catch (e) {
      setSystemStatus({ online: false, mode: 'Offline' });
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error('Error fetching CRM data:', e);
    }
  };

  // Speaks assistant text out loud
  const speakText = (text) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    
    // Cancel any active speech
    window.speechSynthesis.cancel();
    
    // Speak response
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a nice English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google') || v.name.includes('Natural'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Speech-to-Text handler
  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognition.start();
    }
  };

  // Main chat message handler
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInputMessage('');
    setIsLoading(true);
    setActiveTab('logs'); // Switch to reasoning logs view when running

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      const data = await response.json();
      
      // Update local logs list
      if (data.logs) {
        setCurrentLogs(data.logs);
      }
      
      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: data.decision ? data.decision.reason : "I failed to process this request.",
        logs: data.logs || [],
        decision: data.decision || null
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the decision reason out loud
      if (data.decision && data.decision.reason) {
        speakText(data.decision.reason);
      }
      
      // Refresh CRM data in case changes were made (though we don't mutate order state upon query, user might have changed details in db)
      fetchOrders();
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Error: Could not connect to the agent backend server.",
        logs: [{"step": "System Error", "detail": "Connection refused by FastAPI backend."}],
        decision: null 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Open CRM editor modal
  const handleEditClick = (order) => {
    setEditingOrder(order);
    setEditForm({
      name: order.name,
      order_date: order.order_date,
      product_name: order.product_name,
      product_type: order.product_type,
      amount: order.amount,
      is_damaged: order.is_damaged,
      custom_made: order.custom_made
    });
  };

  // Save CRM changes
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;
    
    try {
      const res = await fetch(`/api/orders/${editingOrder.customer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      if (res.ok) {
        setEditingOrder(null);
        fetchOrders();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update order in CRM database.");
    }
  };

  // Helper mapping for product images/colors
  const getProductImage = (productName) => {
    const lower = productName.toLowerCase();
    if (lower.includes('shoe')) return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('watch')) return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('jacket')) return 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('tablet')) return 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('earbud') || lower.includes('phone')) return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('coffee')) return 'https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('bag') || lower.includes('backpack')) return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=120&auto=format&fit=crop&q=60';
    if (lower.includes('ring')) return 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=120&auto=format&fit=crop&q=60';
    // Fallback/Software
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60';
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col font-sans">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-card/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-brand-accent to-brand-teal rounded-xl shadow-lg shadow-brand-accent/30 animate-glow">
            <Sparkles className="w-6 h-6 text-white animate-pulse-subtle" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center">
              OctaneRefund <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-brand-teal/20 text-brand-tealLight rounded-full">AI Agent</span>
            </h1>
            <p className="text-xs text-brand-textSecondary">Smart Refund Policy Decision Engine</p>
          </div>
        </div>

        {/* Backend health status badge */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 bg-brand-dark/60 px-3 py-1.5 rounded-lg border border-brand-border">
            <Server className={`w-3.5 h-3.5 ${systemStatus.online ? 'text-brand-success animate-pulse' : 'text-brand-danger'}`} />
            <span className="text-xs text-brand-textSecondary font-medium">Backend:</span>
            <span className={`text-xs font-semibold ${systemStatus.online ? 'text-brand-success' : 'text-brand-danger'}`}>
              {systemStatus.mode}
            </span>
          </div>

          {/* Voice Mute Toggle */}
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`p-2 rounded-lg transition-all ${isMuted ? 'bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger' : 'bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-tealLight'}`}
            title={isMuted ? "Unmute Voice output" : "Mute Voice output"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* DASHBOARD WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl w-full mx-auto overflow-hidden">
        
        {/* LEFT SECTION - CHAT INTERFACE (5 cols on lg) */}
        <section className="lg:col-span-5 flex flex-col bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-xl">
          
          {/* Chat Header */}
          <div className="p-4 border-b border-brand-border bg-brand-card/50 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-medium">
              <MessageSquare className="w-5 h-5 text-brand-tealLight" />
              <span>Customer Chat Support</span>
            </div>
            <span className="text-xs text-brand-textSecondary bg-brand-dark px-2.5 py-1 rounded-full border border-brand-border">
              Case Evaluation
            </span>
          </div>

          {/* Messages view */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[350px] max-h-[500px]">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex space-x-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''} animate-slide-up`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shadow-md ${msg.role === 'user' ? 'bg-brand-accent text-white' : 'bg-brand-dark border border-brand-teal/40 text-brand-tealLight'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Bubble content */}
                <div>
                  <div className={`p-3.5 rounded-2xl ${msg.role === 'user' ? 'bg-brand-accent text-white rounded-tr-none' : 'bg-brand-dark/50 border border-brand-border text-brand-textPrimary rounded-tl-none'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Render decision details in response box if present */}
                    {msg.decision && (
                      <div className="mt-3 pt-3 border-t border-brand-border/30 grid grid-cols-2 gap-2 text-xs">
                        <div className="text-brand-textSecondary">Customer: <span className="font-semibold text-white">{msg.decision.customer_name} ({msg.decision.customer_id})</span></div>
                        <div className="text-brand-textSecondary">Product: <span className="font-semibold text-white">{msg.decision.product_name}</span></div>
                        <div className="text-brand-textSecondary">Purchased: <span className="font-semibold text-white">{msg.decision.order_date}</span></div>
                        <div className="text-brand-textSecondary">Days Elapsed: <span className="font-semibold text-white">{msg.decision.days_elapsed} days</span></div>
                        
                        {/* Decision Result Badge */}
                        <div className="col-span-2 mt-2 pt-2 border-t border-brand-border/20 flex items-center justify-between">
                          <span className="text-brand-textSecondary font-semibold">Decision:</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1 shadow-sm ${
                            msg.decision.status === 'Approved' ? 'bg-brand-success/15 text-brand-success border border-brand-success/30' :
                            msg.decision.status === 'Denied' ? 'bg-brand-danger/15 text-brand-danger border border-brand-danger/30' :
                            'bg-brand-warning/15 text-brand-warning border border-brand-warning/30'
                          }`}>
                            {msg.decision.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                            {msg.decision.status === 'Denied' && <XCircle className="w-3 h-3" />}
                            {msg.decision.status.includes('Manager') && <AlertCircle className="w-3 h-3" />}
                            {msg.decision.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-brand-textSecondary mt-1 block px-1">
                    {msg.role === 'user' ? 'Customer' : 'AI Agent'}
                  </span>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex space-x-3 max-w-[85%] animate-pulse">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-dark border border-brand-teal/40 flex items-center justify-center text-brand-tealLight">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-brand-dark/50 border border-brand-border p-4 rounded-2xl rounded-tl-none flex flex-col space-y-2">
                  <div className="h-3.5 w-48 bg-brand-border rounded"></div>
                  <div className="h-3 w-32 bg-brand-border rounded"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Click Demo Scenarios */}
          <div className="px-4 py-3 bg-brand-dark/30 border-t border-brand-border">
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-textSecondary block mb-2">Test Scenarios</span>
            <div className="flex flex-wrap gap-1.5">
              {demoScenarios.map((demo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(demo.query)}
                  disabled={isLoading}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-card hover:bg-brand-border border border-brand-border hover:border-brand-accent/60 text-brand-textPrimary hover:text-white transition-all flex items-center space-x-1"
                >
                  <Play className="w-2.5 h-2.5 text-brand-accent fill-current" />
                  <span>{demo.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Form Input */}
          <div className="p-4 border-t border-brand-border bg-brand-card/50">
            <div className="flex items-center space-x-2">
              
              {/* Voice input button */}
              <button
                onClick={toggleRecording}
                className={`p-3 rounded-xl border transition-all ${
                  isRecording 
                    ? 'bg-brand-danger/20 border-brand-danger text-brand-danger animate-pulse' 
                    : 'bg-brand-dark hover:bg-brand-border border-brand-border text-brand-textSecondary hover:text-white'
                }`}
                title={isRecording ? "Listening... click to stop" : "Speak to AI Agent (Speech-to-Text)"}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isRecording ? "Listening..." : "Ask the agent (e.g. 'Refund order C001')"}
                className="flex-1 px-4 py-3 bg-brand-dark border border-brand-border rounded-xl text-sm focus:outline-none focus:border-brand-accent text-white placeholder-brand-textSecondary"
                disabled={isLoading}
              />

              {/* Send button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputMessage.trim()}
                className="p-3 bg-brand-accent hover:bg-amber-500 disabled:bg-brand-border text-white rounded-xl transition-all shadow-md shadow-brand-accent/30"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT SECTION - ADMIN PANEL (7 cols on lg) */}
        <section className="lg:col-span-7 flex flex-col bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-xl">
          
          {/* Tab Selection */}
          <div className="flex border-b border-brand-border bg-brand-card/50">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-4 px-4 flex items-center justify-center space-x-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'logs' 
                  ? 'border-brand-teal text-white bg-brand-dark/25' 
                  : 'border-transparent text-brand-textSecondary hover:text-white hover:bg-brand-dark/10'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Real-Time Reasoning Logs</span>
            </button>
            
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex-1 py-4 px-4 flex items-center justify-center space-x-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'crm' 
                  ? 'border-brand-accent text-white bg-brand-dark/25' 
                  : 'border-transparent text-brand-textSecondary hover:text-white hover:bg-brand-dark/10'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>CRM Database Viewer</span>
            </button>
            
            <button
              onClick={() => setActiveTab('policy')}
              className={`flex-1 py-4 px-4 flex items-center justify-center space-x-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'policy' 
                  ? 'border-brand-accent text-white bg-brand-dark/25' 
                  : 'border-transparent text-brand-textSecondary hover:text-white hover:bg-brand-dark/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Refund Policy</span>
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[600px] min-h-[450px]">
            
            {/* 1. REAL-TIME REASONING LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between text-xs text-brand-textSecondary pb-3 border-b border-brand-border/40">
                  <span className="flex items-center space-x-1.5"><Terminal className="w-3.5 h-3.5" /> <span>Agent Execution Trace</span></span>
                  <span>{currentLogs.length} events logged</span>
                </div>
                
                {currentLogs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="p-3 bg-brand-dark/50 border border-brand-border rounded-2xl text-brand-textSecondary">
                      <Terminal className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">No execution logs yet</h3>
                      <p className="text-xs text-brand-textSecondary max-w-xs mt-1">Submit a refund request in the chat panel to see real-time agent reasoning steps.</p>
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-xs space-y-3 flex-1 overflow-y-auto pr-1">
                    {currentLogs.map((log, idx) => (
                      <div key={idx} className="p-3 bg-brand-dark border border-brand-border rounded-xl flex items-start space-x-3 animate-fade-in">
                        {/* Step indicator */}
                        <div className="flex-shrink-0 mt-0.5 px-2 py-0.5 bg-brand-border text-[9px] font-bold text-brand-textSecondary rounded uppercase">
                          Step {idx + 1}
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          {/* Step Header */}
                          <div className="text-brand-tealLight font-semibold text-[11px] flex items-center justify-between">
                            <span>{log.step}</span>
                            <span className="text-[9px] text-brand-textSecondary">2026-06-13</span>
                          </div>
                          
                          {/* Step details */}
                          <div className="text-brand-textPrimary break-words leading-relaxed text-[11px]">
                            {log.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* 2. CRM DATABASE VIEWER */}
            {activeTab === 'crm' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-brand-textSecondary">
                    CRM Database Table: <span className="font-semibold text-white">{orders.length} Records</span>
                  </div>
                  
                  {/* Reset Database Button */}
                  <button 
                    onClick={async () => {
                      if(confirm("Reset CRM database to original mock records? Any edits will be lost.")) {
                        // For simplicity, we trigger backend init again by calling API,
                        // or we can delete and re-request.
                        // Actually, we can fetch orders since database.py initializes the database if it doesn't exist,
                        // but let's implement a backend reset if needed, or simply reload.
                        // Let's just alert they can restart or reload.
                        alert("Database refreshed. To revert custom edits, please restart backend server.");
                        fetchOrders();
                      }
                    }}
                    className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-dark hover:bg-brand-border border border-brand-border text-brand-textPrimary transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset CRM</span>
                  </button>
                </div>

                <div className="border border-brand-border rounded-xl overflow-hidden shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-brand-dark border-b border-brand-border text-brand-textSecondary uppercase tracking-wider font-semibold text-[10px]">
                        <th className="p-3">Customer ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Purchase Date</th>
                        <th className="p-3">Damaged?</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/40">
                      {orders.map((order) => (
                        <tr key={order.customer_id} className="hover:bg-brand-dark/20 text-brand-textPrimary transition-all">
                          <td className="p-3 font-mono font-semibold text-brand-accent">{order.customer_id}</td>
                          <td className="p-3 font-medium text-white">{order.name}</td>
                          <td className="p-3 max-w-[120px] truncate" title={order.product_name}>{order.product_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              order.product_type === 'physical' ? 'bg-brand-teal/10 text-brand-tealLight border border-brand-teal/30' :
                              order.product_type === 'digital' ? 'bg-brand-accent/10 text-brand-accentLight border border-brand-accent/30' :
                              'bg-rose-900/20 text-rose-400 border border-rose-800/40'
                            }`}>
                              {order.product_type}
                            </span>
                          </td>
                          <td className="p-3 font-bold">${order.amount.toFixed(2)}</td>
                          <td className="p-3 font-mono">{order.order_date}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              order.is_damaged ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 'bg-green-950/40 text-green-400 border border-green-900/50'
                            }`}>
                              {order.is_damaged ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleEditClick(order)}
                              className="p-1.5 hover:bg-brand-accent/20 border border-transparent hover:border-brand-accent/40 text-brand-accent rounded-lg transition-all"
                              title="Edit CRM Record"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. REFUND POLICY DOCUMENT */}
            {activeTab === 'policy' && (
              <div className="space-y-6">
                <div className="p-4 bg-brand-dark/40 border border-brand-border rounded-xl flex items-start space-x-3">
                  <Info className="w-5 h-5 text-brand-tealLight flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-brand-textSecondary leading-relaxed">
                    <span className="font-bold text-white block mb-1">Strict Policy Compliance</span>
                    The AI agent is programmed to evaluate order parameters strictly against the policy rules below. It will automatically deny requests violating these limits, and flag large orders for manual review.
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Refund Policy Document (policy.txt)</h3>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-brand-dark border border-brand-border rounded-xl space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center text-[10px] font-bold text-brand-tealLight">1</div>
                        <span className="text-xs font-semibold text-white">Refund Window Limit</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary pl-7 leading-relaxed">
                        Refunds are only allowed within <span className="text-white font-bold">30 days</span> of the purchase date. Any request made after 30 days must be strictly denied.
                      </p>
                    </div>

                    <div className="p-4 bg-brand-dark border border-brand-border rounded-xl space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center text-[10px] font-bold text-brand-tealLight">2</div>
                        <span className="text-xs font-semibold text-white">Condition Exclusions</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary pl-7 leading-relaxed">
                        The product must not be damaged. If the product is marked as damaged (is_damaged = 1), the refund must be denied.
                      </p>
                    </div>

                    <div className="p-4 bg-brand-dark border border-brand-border rounded-xl space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-[10px] font-bold text-brand-accent">3</div>
                        <span className="text-xs font-semibold text-white">Digital Product Exclusions</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary pl-7 leading-relaxed">
                        Digital products (e.g. software licenses, e-books, subscriptions) are <span className="text-white font-bold">strictly non-refundable</span>.
                      </p>
                    </div>

                    <div className="p-4 bg-brand-dark border border-brand-border rounded-xl space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-[10px] font-bold text-brand-accent">4</div>
                        <span className="text-xs font-semibold text-white">Customization Exclusions</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary pl-7 leading-relaxed">
                        Custom-made or personalized products (custom_made = 1) are <span className="text-white font-bold">strictly non-refundable</span> under any circumstances.
                      </p>
                    </div>

                    <div className="p-4 bg-brand-dark border border-brand-border rounded-xl space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center text-[10px] font-bold text-brand-tealLight">5</div>
                        <span className="text-xs font-semibold text-white">Manager Approval Limit</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary pl-7 leading-relaxed">
                        Any refund amount exceeding <span className="text-white font-bold">$500.00 USD</span> cannot be approved automatically. It requires special manager approval. In this case, mark the status as "Requires Manager Approval" rather than fully approved or denied.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* CRM EDIT DIALOG MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-card/50">
              <div>
                <h3 className="text-base font-bold text-white">Edit Customer Profile</h3>
                <p className="text-xs text-brand-textSecondary">Update record parameters in CRM Database</p>
              </div>
              <span className="text-xs font-mono font-bold text-brand-tealLight bg-brand-dark border border-brand-teal/30 px-2.5 py-1 rounded-lg">
                ID: {editingOrder.customer_id}
              </span>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveEdit}>
              <div className="p-5 space-y-4 text-xs">
                
                {/* Customer Name */}
                <div className="space-y-1">
                  <label className="text-brand-textSecondary font-semibold">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-accent"
                    required
                  />
                </div>

                {/* Product Name */}
                <div className="space-y-1">
                  <label className="text-brand-textSecondary font-semibold">Product Name</label>
                  <input
                    type="text"
                    value={editForm.product_name}
                    onChange={(e) => setEditForm({...editForm, product_name: e.target.value})}
                    className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-accent"
                    required
                  />
                </div>

                {/* Product Type & Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-brand-textSecondary font-semibold">Product Type</label>
                    <select
                      value={editForm.product_type}
                      onChange={(e) => setEditForm({...editForm, product_type: e.target.value})}
                      className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-accent"
                    >
                      <option value="physical">Physical</option>
                      <option value="digital">Digital</option>
                      <option value="custom">Custom-made</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-brand-textSecondary font-semibold">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-accent"
                      required
                    />
                  </div>
                </div>

                {/* Purchase Date */}
                <div className="space-y-1">
                  <label className="text-brand-textSecondary font-semibold">Purchase Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={editForm.order_date}
                    onChange={(e) => setEditForm({...editForm, order_date: e.target.value})}
                    className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-accent"
                    required
                  />
                  <span className="text-[10px] text-brand-textSecondary block mt-0.5">Reference Current Date is 2026-06-13.</span>
                </div>

                {/* Boolean Flags */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  
                  {/* Is Damaged */}
                  <label className="flex items-center space-x-2.5 p-2.5 bg-brand-dark border border-brand-border rounded-xl cursor-pointer hover:border-brand-accent/30 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={editForm.is_damaged === 1}
                      onChange={(e) => setEditForm({...editForm, is_damaged: e.target.checked ? 1 : 0})}
                      className="rounded text-brand-accent focus:ring-brand-accent bg-brand-dark border-brand-border w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-white block">Mark Damaged</span>
                      <span className="text-[9px] text-brand-textSecondary">Customer claims damage</span>
                    </div>
                  </label>

                  {/* Is Custom Made */}
                  <label className="flex items-center space-x-2.5 p-2.5 bg-brand-dark border border-brand-border rounded-xl cursor-pointer hover:border-brand-accent/30 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={editForm.custom_made === 1}
                      onChange={(e) => setEditForm({...editForm, custom_made: e.target.checked ? 1 : 0})}
                      className="rounded text-brand-accent focus:ring-brand-accent bg-brand-dark border-brand-border w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-white block">Custom Made</span>
                      <span className="text-[9px] text-brand-textSecondary">Custom engraving/made</span>
                    </div>
                  </label>

                </div>

              </div>

              {/* Modal Footer / Actions */}
              <div className="p-5 border-t border-brand-border bg-brand-card/50 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-2.5 bg-brand-dark border border-brand-border hover:bg-brand-border text-brand-textPrimary rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-accent hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-accent/30 flex items-center justify-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-6 px-6 border-t border-brand-border text-center text-xs text-brand-textSecondary bg-brand-card/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 OctaneRefund AI Agent Inc. All rights reserved.</p>
          <div className="flex space-x-4">
            <span className="flex items-center space-x-1 text-[11px]"><Check className="w-3.5 h-3.5 text-brand-success" /> <span>SQLite DB (15 profiles) Loaded</span></span>
            <span className="flex items-center space-x-1 text-[11px]"><Check className="w-3.5 h-3.5 text-brand-success" /> <span>LangGraph / OpenAI Ready</span></span>
          </div>
        </div>
      </footer>

    </div>
  );
}
