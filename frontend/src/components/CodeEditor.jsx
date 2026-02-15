import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Client from './Client';

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const username = location.state?.username;

    const [code, setCode] = useState("// Welcome to Vylop!\n// Start typing...");
    const [language, setLanguage] = useState("java"); 
    const [users, setUsers] = useState([]); 
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    const isLocalChange = useRef(false);
    const stompClient = useRef(null);
    const isConnected = useRef(false); // Flag to prevent multiple connections

    useEffect(() => {
        if (!username) {
            toast.error("Username is required");
            navigate('/');
            return;
        }

        // Prevent multiple connection attempts
        if (isConnected.current) return;
        isConnected.current = true;

        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);
        client.debug = () => {}; 

        client.connect({}, () => {
            stompClient.current = client;

            // 1. Subscribe to Code Changes
            client.subscribe(`/topic/code/${roomId}`, (message) => {
                const body = JSON.parse(message.body);
                if (!isLocalChange.current) {
                    setCode(body.content);
                    if (body.language && body.language !== language) setLanguage(body.language);
                }
                isLocalChange.current = false;
            });

            // 2. Subscribe to User List Updates
            client.subscribe(`/topic/users/${roomId}`, (message) => {
                const body = JSON.parse(message.body);
                setUsers(body.activeUsers);
                
                // Show toast only if it's not the local user joining
                if (body.type === "JOIN" && body.username !== username) {
                    toast.success(`${body.username} joined`, { id: `join-${body.username}` });
                }
                if (body.type === "LEAVE") {
                    toast(`${body.username} left`, { icon: '👋', id: `leave-${body.username}` });
                }
            });

            // 3. Send JOIN message
            client.send(`/app/room/${roomId}/join`, {}, JSON.stringify({ username, type: "JOIN" }));

        }, (error) => {
            isConnected.current = false;
            toast.error("Connection failed. Retrying...");
        });

        return () => {
            if (stompClient.current && stompClient.current.connected) {
                stompClient.current.send(`/app/room/${roomId}/leave`, {}, JSON.stringify({ username, type: "LEAVE" }));
                stompClient.current.disconnect();
                isConnected.current = false;
            }
        };
    }, [roomId, username, navigate]); // Removed 'language' to prevent effect re-run on toggle

    const handleEditorChange = (value) => {
        if (stompClient.current?.connected) {
            isLocalChange.current = true;
            setCode(value);
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, 
                content: value, 
                language, 
                type: "CODE" 
            }));
        }
    };

    const runCode = async () => {
        setIsRunning(true);
        setOutput("Running..."); 
        try {
            const response = await axios.post('http://localhost:8080/api/execute', { language, code, input: userInput });
            setOutput(response.data); 
        } catch (error) { setOutput("Execution failed."); }
        finally { setIsRunning(false); }
    };

    return (
        <div style={{ height: "100vh", display: "flex", backgroundColor: "#1e1e1e", overflow: "hidden" }}>
            <Toaster position="top-right" reverseOrder={false} />

            {/* SIDEBAR */}
            <div style={{ 
                width: isSidebarVisible ? "260px" : "0px", 
                background: "#141516", 
                borderRight: isSidebarVisible ? "1px solid #333" : "none", 
                display: "flex", 
                flexDirection: "column", 
                transition: "width 0.3s ease-in-out",
                overflow: "hidden",
                whiteSpace: "nowrap"
            }}>
                <div style={{ padding: "25px", borderBottom: "1px solid #333" }}>
                    <h1 style={{ color: "#4aed88", margin: 0, fontSize: "1.6rem" }}>⚡ VYLOP</h1>
                </div>
                <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}>
                    <p style={{ color: "#5c5c5c", fontSize: "0.75rem", marginBottom: "20px", fontWeight: "800" }}>CONNECTED</p>
                    {users.map((u, index) => <Client key={index} username={u} />)}
                </div>
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button onClick={() => { navigator.clipboard.writeText(roomId); toast.success("Copied!"); }} style={{ background: "#333", color: "#fff", border: "1px solid #444", padding: "10px", borderRadius: "6px", cursor: 'pointer' }}>Copy ID</button>
                    <button onClick={() => navigate('/')} style={{ background: "#ff4757", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "700", cursor: 'pointer' }}>Leave</button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* TOOLBAR */}
                <div style={{ padding: "12px 20px", background: "#1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} style={{ background: 'none', border: 'none', color: '#4aed88', cursor: 'pointer', fontSize: '1.4rem' }}>
                            {isSidebarVisible ? "❮" : "❯"} 
                        </button>
                        <span style={{ color: "#666", fontFamily: "monospace", fontSize: "0.85rem" }}>{roomId}</span>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ background: "#2d2d2d", color: "#fff", border: "1px solid #444", padding: "6px 12px", borderRadius: "6px", cursor: 'pointer' }}>
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                        </select>
                        <button onClick={runCode} disabled={isRunning} style={{ background: "#4aed88", color: "#000", border: "none", padding: "6px 25px", borderRadius: "6px", fontWeight: "700", cursor: 'pointer' }}>
                            {isRunning ? "..." : "Run"}
                        </button>
                    </div>
                </div>

                <div style={{ flexGrow: 1, display: "flex", overflow: "hidden" }}>
                    <div style={{ flex: 7, minWidth: "400px" }}>
                        <Editor height="100%" language={language === "cpp" ? "cpp" : language} theme="vs-dark" value={code} onChange={handleEditorChange} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }} />
                    </div>
                    <div style={{ flex: 3, background: "#1e1e1e", display: "flex", flexDirection: "column", borderLeft: "1px solid #333", minWidth: "250px" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <div style={{ padding: "8px 12px", background: "#252526", fontSize: "0.75rem", color: "#5c5c5c", fontWeight: 'bold' }}>INPUT</div>
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} style={{ flexGrow: 1, background: "#1e1e1e", color: "#fff", border: "none", padding: "12px", resize: "none", outline: "none", fontFamily: "monospace" }} />
                        </div>
                        <div style={{ flex: 1, borderTop: "1px solid #333", display: "flex", flexDirection: "column" }}>
                            <div style={{ padding: "8px 12px", background: "#252526", fontSize: "0.75rem", color: "#5c5c5c", fontWeight: 'bold' }}>OUTPUT</div>
                            <pre style={{ padding: "15px", color: "#d1d1d1", margin: 0, overflowY: "auto", fontSize: "0.85rem", flexGrow: 1 }}>{output || "No output yet..."}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;