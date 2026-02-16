import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import './Home.css'; 
// Ensure Home.css also imports the brand styles if they are not global, 
// or simply add the CodeEditor.css import here if they are shared.
// For this fix, assume CodeEditor.css is global or imported here:
import './CodeEditor.css'; 

const Home = () => {
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidv4();
        setRoomId(id);
        toast.success('Created a new room');
    };

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('ROOM ID & username is required');
            return;
        }

        // Redirect
        navigate(`/room/${roomId}`, {
            state: {
                username,
            },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="homePageWrapper">
            <div className="formWrapper">
                
                {/* --- LARGE TERMINAL PROMPT LOGO --- */}
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
                        className="inputBox"
                        placeholder="ROOM ID"
                        onChange={(e) => setRoomId(e.target.value)}
                        value={roomId}
                        onKeyUp={handleInputEnter}
                    />
                    <input
                        type="text"
                        className="inputBox"
                        placeholder="USERNAME"
                        onChange={(e) => setUsername(e.target.value)}
                        value={username}
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

            <footer>
                <h4>Built with 💛 by Shardool</h4>
            </footer>
        </div>
    );
};

export default Home;