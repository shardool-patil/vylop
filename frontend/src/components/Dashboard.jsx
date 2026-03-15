import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import './CodeEditor.css'; // Reusing your existing styles

const API_BASE_URL = 'https://vylop.onrender.com';

const Dashboard = () => {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Retrieve username from local storage (set during login)
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
            state: {
                username: username,
                roomName: "New Workspace"
            }
        });
    };

    const handleOpenWorkspace = (roomId, roomName) => {
        navigate(`/room/${roomId}`, {
            state: {
                username: username,
                roomName: roomName
            }
        });
    };

    const handleDeleteWorkspace = async (roomId, roomName) => {
        if (!window.confirm(`Are you sure you want to delete "${roomName}"? This cannot be undone.`)) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/workspace/${roomId}/delete?username=${encodeURIComponent(username)}`);
            toast.success(`Deleted ${roomName}`);
            // Remove the deleted workspace from UI without reloading the page
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
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-dark)' }}>
            
            {/* Minimal Navbar */}
            <div className="toolbar" style={{ justifyContent: 'space-between', padding: '0 30px' }}>
                <div className="brand-logo">
                    <span className="brand-prompt">&gt;</span><span>Vylop</span><span className="brand-cursor"></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{username}</span>
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                            localStorage.removeItem('username');
                            navigate('/auth');
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h1 style={{ color: '#fff', margin: 0, fontSize: '2rem' }}>Your Workspaces</h1>
                    <button className="btn btn-primary" onClick={handleCreateNew} style={{ padding: '10px 20px', fontSize: '1rem' }}>
                        + New Workspace
                    </button>
                </div>

                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px', color: 'var(--text-muted)' }}>
                        <h2>Loading workspaces...</h2>
                    </div>
                ) : workspaces.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '10vh', padding: '40px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                        <h2 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>No saved workspaces yet.</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Create a new workspace, write some code, and click "Save to Cloud" in the editor!</p>
                        <button className="btn btn-primary" onClick={handleCreateNew}>
                            Create your first workspace
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {workspaces.map(ws => (
                            <div key={ws.id} style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                            onClick={() => handleOpenWorkspace(ws.id, ws.name)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ color: '#fff', margin: 0, fontSize: '1.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {ws.name}
                                    </h3>
                                    <button 
                                        className="btn btn-icon" 
                                        style={{ color: '#da3633', padding: '5px', background: 'transparent' }}
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevents opening the room when clicking delete
                                            handleDeleteWorkspace(ws.id, ws.name);
                                        }}
                                        title="Delete Workspace"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    {formatDate(ws.createdAt)}
                                </div>
                                
                                <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(88, 166, 255, 0.1)', color: '#58a6ff' }}>
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