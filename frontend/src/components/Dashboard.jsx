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
    const [joinRoomId, setJoinRoomId] = useState("");
    
    const username = localStorage.getItem('username');

    useEffect(() => {
        if (!username) {
            toast.error("SYSTEM ERROR: UNKNOWN USER");
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
            console.error("Fetch error:", error);
            toast.error("ERR_CONNECTION_REFUSED");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        const roomId = uuidv4();
        navigate(`/room/${roomId}`, {
            state: { username: username, roomName: "root@vylop:~#" }
        });
    };

    const handleJoinExisting = () => {
        if (!joinRoomId.trim()) return;
        navigate(`/room/${joinRoomId.trim()}`, {
            state: { username: username, roomName: "Remote Connection" }
        });
    };

    const handleOpenWorkspace = (roomId, roomName) => {
        navigate(`/room/${roomId}`, {
            state: { username: username, roomName: roomName }
        });
    };

    const handleDeleteWorkspace = async (roomId, roomName) => {
        if (!window.confirm(`WARN: Execute rm -rf on "${roomName}"?`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/workspace/${roomId}/delete?username=${encodeURIComponent(username)}`);
            toast.success(`FILE_DELETED`);
            setWorkspaces(prev => prev.filter(ws => ws.id !== roomId));
        } catch (error) {
            toast.error("PERMISSION_DENIED");
        }
    };

    return (
        <div style={{ backgroundColor: '#000000', color: '#00FF41', fontFamily: '"Courier New", Courier, monospace', height: '100vh', width: '100vw', padding: '40px', overflowY: 'auto', boxSizing: 'border-box' }}>
            
            <div style={{ borderBottom: '2px dashed #00FF41', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem', letterSpacing: '2px' }}>VYLOP_MAINFRAME_v3.1</h1>
                    <p style={{ margin: '10px 0 0 0', opacity: 0.8 }}>CONNECTION ESTABLISHED...</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '10px' }}>LOGGED IN AS: <span style={{ fontWeight: 'bold', background: '#00FF41', color: '#000', padding: '2px 6px' }}>{username}</span></div>
                    <button onClick={() => { localStorage.removeItem('username'); navigate('/auth'); }} 
                            style={{ background: 'transparent', color: '#00FF41', border: '1px solid #00FF41', padding: '5px 15px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        [ TERMINATE_SESSION ]
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
                <div style={{ flex: 1, border: '1px solid #00FF41', padding: '20px', background: 'rgba(0, 255, 65, 0.05)' }}>
                    <h2 style={{ margin: '0 0 20px 0' }}>{">"} EXECUTE_COMMAND</h2>
                    <button onClick={handleCreateNew} 
                            style={{ display: 'block', width: '100%', background: '#00FF41', color: '#000', border: 'none', padding: '15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '15px', fontSize: '1.1rem' }}>
                        ./INITIALIZE_NEW_WORKSPACE.sh
                    </button>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value)} placeholder="INPUT_ROOM_HASH..." 
                               style={{ flex: 1, background: '#000', color: '#00FF41', border: '1px solid #00FF41', padding: '10px', fontFamily: 'inherit', outline: 'none' }} />
                        <button onClick={handleJoinExisting} 
                                style={{ background: 'transparent', color: '#00FF41', border: '1px solid #00FF41', padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            CONNECT
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h2 style={{ borderBottom: '1px solid #00FF41', paddingBottom: '10px', marginBottom: '20px' }}>{">"} LS -LA ./SAVED_DIRECTORIES</h2>
                
                {isLoading ? (
                    <p className="blink">SCANNING_DRIVES...</p>
                ) : workspaces.length === 0 ? (
                    <p>NO_DIRECTORIES_FOUND</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                        {workspaces.map((ws, index) => (
                            <div key={ws.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid rgba(0, 255, 65, 0.3)' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <span style={{ opacity: 0.5 }}>[{index.toString().padStart(3, '0')}]</span>
                                    <span onClick={() => handleOpenWorkspace(ws.id, ws.name)} style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '1.2rem' }}>
                                        {ws.name}
                                    </span>
                                    <span style={{ opacity: 0.5 }}>{new Date(ws.createdAt).toISOString()}</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id, ws.name); }} 
                                        style={{ background: 'transparent', color: '#ff003c', border: '1px solid #ff003c', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    [ DELETE ]
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .blink { animation: blink-animation 1s steps(5, start) infinite; }
                @keyframes blink-animation { to { visibility: hidden; } }
            `}</style>
        </div>
    );
};

export default Dashboard;