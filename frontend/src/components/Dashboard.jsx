import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import './CodeEditor.css'; 

const API_BASE_URL = 'https://vylop.onrender.com';

const Dashboard = () => {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState("");
    
    const username = localStorage.getItem('username');

    useEffect(() => {
        if (!username) {
            toast.error("Please login first");
            navigate('/auth');
            return;
        }
        fetchWorkspaces();
    }, [username, navigate]);

    const fetchWorkspaces = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/workspace/user/${username}`);
            setWorkspaces(response.data);
        } catch (error) {
            console.error("Error fetching workspaces:", error);
            toast.error("Failed to load your workspaces");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        const roomId = uuidv4();
        navigate(`/room/${roomId}`, {
            state: { username: username, roomName: "New Workspace" }
        });
    };

    const handleJoinExisting = () => {
        if (!joinRoomId.trim()) {
            toast.error("Please enter a valid Room ID");
            return;
        }
        navigate(`/room/${joinRoomId.trim()}`, {
            state: { username: username, roomName: "Joined Workspace" }
        });
    };

    const handleOpenWorkspace = (roomId, roomName) => {
        navigate(`/room/${roomId}`, {
            state: { username: username, roomName: roomName }
        });
    };

    const handleDeleteWorkspace = async (roomId, roomName) => {
        if (!window.confirm(`Are you sure you want to delete "${roomName}"? This cannot be undone.`)) {
            return;
        }
        try {
            await axios.delete(`${API_BASE_URL}/api/workspace/${roomId}/delete?username=${encodeURIComponent(username)}`);
            toast.success(`Deleted ${roomName}`);
            setWorkspaces(prev => prev.filter(ws => ws.id !== roomId));
        } catch (error) {
            console.error("Delete error:", error);
            toast.error(error.response?.data || "Failed to delete workspace");
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Unknown date";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', overflowY: 'auto' }}>
            
            {/* Minimal Navbar */}
            <div className="toolbar" style={{ justifyContent: 'space-between', padding: '0 30px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)' }}>
                <div className="brand-logo">
                    <span className="brand-prompt">&gt;</span><span>Vylop</span><span className="brand-cursor"></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2ea043' }}></div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{username}</span>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { localStorage.removeItem('username'); navigate('/auth'); }}>
                        Logout
                    </button>
                </div>
            </div>

            {/* Quick Join Modal */}
            {isJoinModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 1000 }}>
                    <div className="custom-modal" style={{ width: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Join Workspace</h3>
                            <button className="btn btn-icon" onClick={() => setIsJoinModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
                            Enter the specific Room ID or link provided by your host to join an active session.
                        </p>
                        <div className="modal-field">
                            <input type="text" className="modal-input modern-input" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value)}
                                placeholder="e.g. 123e4567-e89b-12d3..." onKeyDown={(e) => e.key === 'Enter' && handleJoinExisting()} autoFocus />
                        </div>
                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button className="btn btn-secondary" onClick={() => setIsJoinModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleJoinExisting}>Join Room</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                
                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', letterSpacing: '-0.5px' }}>Welcome back to <span style={{ color: '#58a6ff' }}>Vylop 2.0</span> 🚀</h1>                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Create a sandbox to test ideas, start a secure technical interview, or join an active collaborative session.
                    </p>
                </div>

                {/* Hero Action Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '50px' }}>
                    
                    {/* Card 1: Sandbox / Create */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(88, 166, 255, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(88, 166, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px', transition: 'transform 0.2s', cursor: 'default' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(88, 166, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Dev Sandbox</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
                            Instantly spin up a new CRDT-powered workspace. Perfect for pair programming, debugging, or testing out an algorithm.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handleCreateNew}>Create Room</button>
                            <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setIsJoinModalOpen(true)}>Join Existing</button>
                        </div>
                    </div>

                    {/* Card 2: Interview */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(210, 153, 34, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(210, 153, 34, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(210, 153, 34, 0.2)', color: '#d29922', padding: '4px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Premium</div>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(210, 153, 34, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d29922' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Start Interview</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
                            Host a secure, structured technical interview. Includes hidden test cases, host-only controls, and optional proctoring.
                        </p>
                        <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', marginTop: '10px', borderColor: 'rgba(210, 153, 34, 0.4)', color: '#d29922' }} onClick={() => toast("Interview mode is currently in Beta. Coming soon!", { icon: '🚧' })}>Configure Interview</button>
                    </div>

                    {/* Card 3: Competition */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(137, 87, 229, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(137, 87, 229, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(137, 87, 229, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8957e5' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Join Competition</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
                            Enter a competitive coding arena. Strict timers, disabled copy-paste, and automated algorithmic scoring.
                        </p>
                        <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', marginTop: '10px', borderColor: 'rgba(137, 87, 229, 0.4)', color: '#8957e5' }} onClick={() => toast("Competition mode is currently in Beta. Coming soon!", { icon: '🚧' })}>View Active Arenas</button>
                    </div>

                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '40px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    <span style={{ padding: '0 20px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Saved Cloud Workspaces</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                {/* Saved Workspaces Grid */}
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                        <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
                    </div>
                ) : workspaces.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginBottom: '15px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <h3 style={{ color: 'var(--text-main)', margin: '0 0 10px 0' }}>No saved workspaces yet.</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Create a new sandbox, write some code, and click the cloud save icon in the editor!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
                        {workspaces.map(ws => (
                            <div key={ws.id} style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.borderColor = 'rgba(88, 166, 255, 0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            }}
                            onClick={() => handleOpenWorkspace(ws.id, ws.name)}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#58a6ff' }}></div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
                                        {ws.name}
                                    </h3>
                                    <button 
                                        className="btn btn-icon" 
                                        style={{ color: 'var(--text-muted)', padding: '5px', background: 'transparent' }}
                                        onMouseOver={(e) => e.currentTarget.style.color = '#ff6b6b'}
                                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            handleDeleteWorkspace(ws.id, ws.name);
                                        }}
                                        title="Delete Workspace"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '8px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    Last active: {formatDate(ws.createdAt)}
                                </div>
                                
                                <div style={{ marginTop: 'auto', paddingTop: '15px', paddingLeft: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(88, 166, 255, 0.1)', color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Host
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;