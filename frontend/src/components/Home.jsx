import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';

const Home = () => {
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidv4();
        setRoomId(id);
        toast.success('Generated a new Room ID');
    };

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('ROOM ID & Username is required');
            return;
        }
        // Redirect to Editor and pass username via state
        navigate(`/room/${roomId}`, {
            state: { username },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') joinRoom();
    };

    return (
        <div className="homePageWrapper">
            <Toaster position="top-right" />
            <div className="formWrapper">
                <h1 className="logoText">⚡ VYLOP</h1>
                <p className="mainLabel">Paste invitation ROOM ID to join</p>
                
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
                    
                    <button className="joinBtn" onClick={joinRoom}>
                        Join Room
                    </button>
                    
                    <span className="createInfo">
                        Don't have an invite? &nbsp;
                        <a onClick={createNewRoom} href="#" className="createNewBtn">
                            Create New Room
                        </a>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Home;