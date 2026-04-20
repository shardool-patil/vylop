import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css'; 

const API_BASE_URL = 'https://vylop.onrender.com';

const Home = () => {
    const navigate = useNavigate();

    const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
    const [recentRooms, setRecentRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    
    // Modal & Menu States
    const [workspaceToDelete, setWorkspaceToDelete] = useState(null);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [joinRoomName, setJoinRoomName] = useState('');
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    useEffect(() => {
        if (!username) {
            toast.error("Please login first");
            navigate('/auth');
            return;
        }
        fetchRecentRooms(username);
    }, [username, navigate]);

    const fetchRecentRooms = async (user) => {
        setIsLoadingRooms(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/workspace/user/${user}`);
            setRecentRooms(response.data);
        } catch (error) {
            console.error("Failed to fetch recent rooms:", error);
            toast.error("Failed to load workspaces");
        } finally {
            setIsLoadingRooms(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('username');
        localStorage.removeItem('loginType');
        toast('Logged out successfully', { icon: '👋' });
        navigate('/auth');
    };

    // FIXED: Now registers the room in the DB before navigating so it can be saved!
    const handleCreateNew = async () => {
        const id = uuidv4();
        const defaultRoomName = "Dev Workspace";

        try {
            await axios.post(
                `${API_BASE_URL}/api/workspace/${id}/register?username=${encodeURIComponent(username)}&roomName=${encodeURIComponent(defaultRoomName)}`
            );
        } catch (error) {
            console.warn("Could not pre-register room name:", error);
        }

        navigate(`/room/${id}`, {
            state: {
                username,
                roomName: defaultRoomName,
            },
        });
    };

    const joinRoom = async () => {
        if (!joinRoomId.trim()) {
            toast.error('ROOM ID is required');
            return;
        }

        const finalRoomName = joinRoomName.trim() ? joinRoomName : "Joined Workspace";

        try {
            await axios.post(
                `${API_BASE_URL}/api/workspace/${joinRoomId}/register?username=${encodeURIComponent(username)}&roomName=${encodeURIComponent(finalRoomName)}`
            );
        } catch (error) {
            console.warn("Could not pre-register room name:", error);
        }

        navigate(`/room/${joinRoomId.trim()}`, {
            state: { username, roomName: finalRoomName },
        });
    };

    const joinRecentRoom = (id, name) => {
        navigate(`/room/${id}`, { state: { username, roomName: name } });
    };

    const confirmDeleteWorkspace = async () => {
        if (!workspaceToDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/workspace/${workspaceToDelete.id}/delete?username=${encodeURIComponent(username)}`);
            toast.success(`${workspaceToDelete.name} deleted successfully!`, { icon: '🗑️' });
            setRecentRooms(prev => prev.filter(r => r.id !== workspaceToDelete.id));
        } catch (error) {
            toast.error(error.response?.data || "Failed to delete workspace");
        } finally {
            setWorkspaceToDelete(null);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Recently";
        const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(utcDateString).toLocaleDateString(undefined, options);
    };

    const copyRoomLink = (id, e) => {
        if (e) e.stopPropagation();
        const link = `${window.location.origin}/room/${id}`;
        navigator.clipboard.writeText(link);
        toast.success('Invite link copied!', { icon: '🔗' });
    };

    return (
        <div className="homePageWrapper">
            
            {/* DELETE MODAL */}
            {workspaceToDelete && (
                <div className="modal-overlay" onClick={() => setWorkspaceToDelete(null)}>
                    <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{marginTop: 0, marginBottom: '15px'}}>Delete Workspace</h3>
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', margin: '5px 0 20px 0', lineHeight: '1.5'}}>
                            Are you sure you want to delete <strong>{workspaceToDelete.name}</strong>? <br/><br/>
                            This action is permanent and will destroy all saved code inside this room.
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setWorkspaceToDelete(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDeleteWorkspace}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* JOIN MODAL */}
            {isJoinModalOpen && (
                <div className="modal-overlay" onClick={() => setIsJoinModalOpen(false)}>
                    <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{marginTop: 0, marginBottom: '15px'}}>Join Workspace</h3>
                        <p style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '20px', lineHeight: '1.4' }}>
                            Paste the Room ID provided by your host to join an active coding session.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" className="modern-input" placeholder="ROOM ID (e.g. 123e4567...)" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinRoom()} autoFocus />
                            <input type="text" className="modern-input" placeholder="OPTIONAL: Local Room Name" value={joinRoomName} onChange={(e) => setJoinRoomName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinRoom()} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setIsJoinModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={joinRoom}>Join Room</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER - LeetCode Style */}
            <div className="header-nav">
                <div className="brand-logo">
                    <span className="brand-prompt">&gt;</span><span>Vylop</span><span className="brand-cursor"></span>
                </div>
                
                <div className="user-profile-widget">
                    <div className={`profile-trigger ${isProfileMenuOpen ? 'active' : ''}`} 
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        title="Profile Options"
                    >
                        <div className="user-avatar-leetcode">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    
                    {isProfileMenuOpen && (
                        <div className="profile-dropdown-menu">
                            <div className="menu-header">
                                <div className="user-avatar-menu">
                                    {username.charAt(0).toUpperCase()}
                                </div>
                                <span className="user-name-menu">{username}</span>
                            </div>
                            <div className="divider-horizontal"></div>
                            <button className="menu-item logout-btn" onClick={handleLogout}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 11l4 4-4 4M20 15H10"/></svg>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT - The 3-Card Dashboard */}
            <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box', flex: 1 }}>
                
                <div style={{ marginBottom: '50px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.8rem', marginBottom: '15px', letterSpacing: '-0.5px', color: '#fff' }}>Welcome back to <span style={{ color: '#58a6ff' }}>Vylop</span>.</h1>
                    <p style={{ color: '#8b949e', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
                        Create a sandbox to test ideas, start a secure technical interview, or join an active collaborative session.
                    </p>
                </div>

                {/* HERO CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '60px' }}>
                    
                    {/* Card 1: Sandbox */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(88, 166, 255, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(88, 166, 255, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(88, 166, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0, color: '#fff' }}>Dev Sandbox</h2>
                        <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                            Instantly spin up a new CRDT-powered workspace. Perfect for pair programming, debugging, or testing out an algorithm.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateNew}>Create Room</button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsJoinModalOpen(true)}>Join Existing</button>
                        </div>
                    </div>

                    {/* Card 2: Interview */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(210, 153, 34, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(210, 153, 34, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(210, 153, 34, 0.2)', color: '#d29922', padding: '4px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Premium</div>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(210, 153, 34, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d29922' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0, color: '#fff' }}>Start Interview</h2>
                        <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                            Host a secure, structured technical interview. Includes hidden test cases, host-only controls, and optional proctoring.
                        </p>
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px', borderColor: 'rgba(210, 153, 34, 0.4)', color: '#d29922' }} onClick={() => toast("Interview mode is currently in Beta. Coming soon!", { icon: '🚧' })}>Configure Interview</button>
                    </div>

                    {/* Card 3: Competition */}
                    <div style={{ background: 'linear-gradient(145deg, rgba(137, 87, 229, 0.1) 0%, rgba(33, 38, 45, 0.4) 100%)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(137, 87, 229, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(137, 87, 229, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8957e5' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', margin: 0, color: '#fff' }}>Join Competition</h2>
                        <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                            Enter a competitive coding arena. Strict timers, disabled copy-paste, and automated algorithmic scoring.
                        </p>
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px', borderColor: 'rgba(137, 87, 229, 0.4)', color: '#8957e5' }} onClick={() => toast("Competition mode is currently in Beta. Coming soon!", { icon: '🚧' })}>View Active Arenas</button>
                    </div>

                </div>

                {/* DIVIDER */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '40px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#30363d' }}></div>
                    <span style={{ padding: '0 20px', color: '#8b949e', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Saved Cloud Workspaces</span>
                    <div style={{ flex: 1, height: '1px', background: '#30363d' }}></div>
                </div>

                {/* SAVED WORKSPACES GRID */}
                {isLoadingRooms ? (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0', color: '#8b949e' }}>
                        <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
                    </div>
                ) : recentRooms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed #30363d' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b949e', marginBottom: '15px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <h3 style={{ color: '#c9d1d9', margin: '0 0 10px 0' }}>No saved workspaces yet.</h3>
                        <p style={{ color: '#8b949e', margin: 0, fontSize: '0.9rem' }}>Create a new sandbox, write some code, and click the cloud save icon in the editor!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
                        {recentRooms.map((room) => (
                            <div key={room.id} style={{
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
                            onClick={() => joinRecentRoom(room.id, room.name)}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#58a6ff' }}></div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
                                        {room.name}
                                    </h3>
                                    <div style={{display: 'flex', gap: '4px'}}>
                                        <button 
                                            className="btn-icon" 
                                            style={{ color: '#8b949e', padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                            onMouseOver={(e) => e.currentTarget.style.color = '#58a6ff'}
                                            onMouseOut={(e) => e.currentTarget.style.color = '#8b949e'}
                                            onClick={(e) => copyRoomLink(room.id, e)}
                                            title="Copy Link"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                        </button>
                                        <button 
                                            className="btn-icon" 
                                            style={{ color: '#8b949e', padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                            onMouseOver={(e) => e.currentTarget.style.color = '#f85149'}
                                            onMouseOut={(e) => e.currentTarget.style.color = '#8b949e'}
                                            onClick={(e) => { e.stopPropagation(); setWorkspaceToDelete(room); }}
                                            title="Delete Workspace"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                                
                                <div style={{ color: '#8b949e', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '8px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    Last active: {formatDate(room.createdAt)}
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

            <footer>
                <h4>Built with 💛 by Shardool</h4>
            </footer>
        </div>
    );
};

export default Home;