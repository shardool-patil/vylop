import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css'; 
import './CodeEditor.css'; 

const Home = () => {
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState('');
    const [roomName, setRoomName] = useState(''); 
    const [username, setUsername] = useState('');
    
    const [recentRooms, setRecentRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);

    const [workspaceToDelete, setWorkspaceToDelete] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('vylop_username');
        if (!storedUser) {
            navigate('/auth');
        } else {
            setUsername(storedUser);
            fetchRecentRooms(storedUser); 
        }
    }, [navigate]);

    const fetchRecentRooms = async (user) => {
        setIsLoadingRooms(true);
        try {
            const response = await axios.get(`http://localhost:8080/api/workspace/user/${user}`);
            setRecentRooms(response.data);
        } catch (error) {
            console.error("Failed to fetch recent rooms:", error);
            toast.error("Could not load recent workspaces.");
        } finally {
            setIsLoadingRooms(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('vylop_username');
        navigate('/auth');
        toast('Logged out', { icon: '👋' });
    };

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidv4();
        setRoomId(id);
        toast.success('Generated a new Room ID');
    };

    const joinRoom = () => {
        if (!roomId) {
            toast.error('ROOM ID is required');
            return;
        }

        navigate(`/room/${roomId}`, {
            state: {
                username,
                roomName: roomName.trim() ? roomName : "Dev Workspace", 
            },
        });
    };

    const joinRecentRoom = (id, name) => {
        navigate(`/room/${id}`, {
            state: {
                username,
                roomName: name, 
            },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    const confirmDeleteWorkspace = async () => {
        if (!workspaceToDelete) return;
        
        try {
            await axios.delete(`http://localhost:8080/api/workspace/${workspaceToDelete.id}/delete?username=${username}`);
            
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
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    if (!username) return null; 

    return (
        <div className="homePageWrapper">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>

            {workspaceToDelete && (
                <div className="modal-overlay" onClick={() => setWorkspaceToDelete(null)}>
                    <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Workspace</h3>
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', margin: '5px 0 15px 0', lineHeight: '1.4'}}>
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

            {/* --- NEW: Sleek User Profile Pill --- */}
            <div className="header-nav">
                <div className="user-profile-pill">
                    <div className="user-avatar">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <span className="user-name">{username}</span>
                    <div className="divider-vertical"></div>
                    <button className="logout-btn-icon" onClick={handleLogout} title="Log out">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="dashboard-layout">
                <div className="formWrapper">
                    <div className="logo-container">
                        <div className="brand-logo" style={{fontSize: '3rem'}}>
                            <span className="brand-prompt" style={{fontSize: '3rem'}}>&gt;</span>
                            <span>Vylop</span>
                            <span className="brand-cursor" style={{height: '8px', width: '20px'}}></span>
                        </div>
                    </div>
                    
                    <h4 className="inputLabel">Real-time collaboration for developers. Paste invitation ROOM ID to join.</h4>
                    
                    <div className="inputGroup">
                        <input
                            type="text"
                            className="inputBox modern-input"
                            placeholder="ROOM ID"
                            onChange={(e) => setRoomId(e.target.value)}
                            value={roomId}
                            onKeyUp={handleInputEnter}
                        />
                        <input
                            type="text"
                            className="inputBox modern-input"
                            placeholder="ROOM NAME (e.g. React Project)"
                            onChange={(e) => setRoomName(e.target.value)}
                            value={roomName}
                            onKeyUp={handleInputEnter}
                        />
                        
                        <button className="btn joinBtn" onClick={joinRoom}>
                            Join Room
                        </button>
                        
                        <span className="createInfo">
                            If you don't have an invite then &nbsp;
                            <a onClick={createNewRoom} href="" className="createNewBtn">
                                new room
                            </a>
                        </span>
                    </div>
                </div>

                <div className="recent-workspaces-wrapper">
                    <h3 className="dashboard-title">Recent Workspaces</h3>
                    
                    {isLoadingRooms ? (
                        <div className="loading-state">Loading your projects...</div>
                    ) : recentRooms.length === 0 ? (
                        <div className="empty-state">
                            <p>No saved workspaces yet.</p>
                            <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Create a room and click "Save to Cloud" to see it here!</span>
                        </div>
                    ) : (
                        <div className="workspaces-grid">
                            {recentRooms.map((room) => (
                                <div key={room.id} className="workspace-card" onClick={() => joinRecentRoom(room.id, room.name)}>
                                    <div className="workspace-card-header">
                                        <div className="workspace-title-wrapper">
                                            <h4>{room.name}</h4>
                                            <span className="workspace-date">{formatDate(room.createdAt)}</span>
                                        </div>
                                        
                                        <button 
                                            className="btn-icon delete-workspace-btn" 
                                            onClick={(e) => { 
                                                e.stopPropagation();
                                                setWorkspaceToDelete(room); 
                                            }}
                                            title="Delete Workspace"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                    <div className="workspace-card-body">
                                        <p className="workspace-id-badge">ID: {room.id.substring(0, 8)}...</p>
                                    </div>
                                    <div className="workspace-card-footer">
                                        <span className="open-link">Open Workspace &rarr;</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <footer>
                <h4>Built with 💛 by Shardool</h4>
            </footer>
        </div>
    );
};

export default Home;