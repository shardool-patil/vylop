import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css'; 

const API_BASE_URL = 'https://vylop.onrender.com';

const Home = () => {
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState('');
    const [roomName, setRoomName] = useState('');

    const [username, setUsername] = useState(() => {
        return localStorage.getItem('username') || '';
    });

    const [recentRooms, setRecentRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [workspaceToDelete, setWorkspaceToDelete] = useState(null);

    useEffect(() => {
        if (username) {
            fetchRecentRooms(username);
        }
    }, [username]);

    const fetchRecentRooms = async (user) => {
        setIsLoadingRooms(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/workspace/user/${user}`);
            setRecentRooms(response.data);
        } catch (error) {
            console.error("Failed to fetch recent rooms:", error);
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
            await axios.delete(`${API_BASE_URL}/api/workspace/${workspaceToDelete.id}/delete?username=${username}`);
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

    const copyRoomLink = (id, e) => {
        if (e) e.stopPropagation();
        const link = `${window.location.origin}/room/${id}`;
        navigator.clipboard.writeText(link);
        toast.success('Invite link copied!', { icon: '🔗' });
    };

    return (
        <div className="homePageWrapper">
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

            <div className="header-nav">
                <div className="user-profile-pill">
                    <div className="user-avatar">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <span className="user-name">{username}</span>
                    <div className="divider-vertical"></div>
                    <button className="logout-btn-icon" onClick={handleLogout} title="Log out">
                        Logout
                    </button>
                </div>
            </div>

            <div className="dashboard-layout">
                <div className="formWrapper">
                    <h4 className="inputLabel">
                        Real-time collaboration for developers. Paste invitation ROOM ID to join.
                    </h4>

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
                            placeholder="ROOM NAME"
                            onChange={(e) => setRoomName(e.target.value)}
                            value={roomName}
                            onKeyUp={handleInputEnter}
                        />
                        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                            <button className="btn joinBtn" style={{flex: 1}} onClick={joinRoom}>
                                Join Room
                            </button>
                            {roomId && (
                                <button className="btn btn-secondary" onClick={(e) => copyRoomLink(roomId, e)} title="Copy Shareable Link">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </button>
                            )}
                        </div>
                        <span className="createInfo" style={{marginTop: '15px'}}>
                            If you don't have an invite then&nbsp;
                            <a onClick={createNewRoom} href="/" className="createNewBtn">
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
                        </div>
                    ) : (
                        <div className="workspaces-grid">
                            {recentRooms.map((room) => (
                                <div key={room.id} className="workspace-card" onClick={() => joinRecentRoom(room.id, room.name)}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                        <h4>{room.name}</h4>
                                        <button 
                                            className="btn-icon" 
                                            onClick={(e) => copyRoomLink(room.id, e)} 
                                            title="Copy Invite Link" 
                                            style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0'}}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                        </button>
                                    </div>
                                    <p>ID: {room.id.substring(0, 8)}...</p>
                                    <span>{formatDate(room.createdAt)}</span>
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