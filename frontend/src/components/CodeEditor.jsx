import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Split from 'react-split';
import Client from './Client';
import './CodeEditor.css'; 

const CODE_SNIPPETS = {
    java: `// Welcome to Vylop!\n// Java is selected\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    python: `# Welcome to Vylop!\n# Python is selected\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
    cpp: `// Welcome to Vylop!\n// C++ is selected\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`
};

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const username = location.state?.username;

    const [code, setCode] = useState(CODE_SNIPPETS["java"]);
    const [language, setLanguage] = useState("java"); 
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [users, setUsers] = useState([]); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // Chat & Typing States
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    
    const [splitDirection, setSplitDirection] = useState(window.innerWidth < 900 ? 'vertical' : 'horizontal');

    // Refs
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const remoteCursors = useRef({}); 
    const chatContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isLocalChange = useRef(false);
    const stompClient = useRef(null);
    const isConnected = useRef(false);

    useEffect(() => {
        const handleResize = () => setSplitDirection(window.innerWidth < 900 ? 'vertical' : 'horizontal');
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        editor.onDidChangeCursorPosition((e) => {
            if (stompClient.current?.connected) {
                stompClient.current.send(`/app/cursor/${roomId}`, {}, JSON.stringify({
                    username,
                    lineNumber: e.position.lineNumber,
                    column: e.position.column
                }));
            }
        });
    };

    const updateRemoteCursor = (user, pos) => {
        if (!editorRef.current || !monacoRef.current || user === username) return;

        if (remoteCursors.current[user]) {
            editorRef.current.removeContentWidget(remoteCursors.current[user]);
        }

        const widgetId = `cursor-${user}`;
        const widget = {
            getId: () => widgetId,
            getDomNode: () => {
                const node = document.createElement('div');
                node.className = 'remote-cursor';
                node.style.height = `${editorRef.current.getOption(monacoRef.current.editor.EditorOption.lineHeight)}px`;
                
                const label = document.createElement('div');
                label.className = 'remote-cursor-label';
                label.innerText = user;
                node.appendChild(label);
                
                return node;
            },
            getPosition: () => ({
                position: { lineNumber: pos.lineNumber, column: pos.column },
                preference: [monacoRef.current.editor.ContentWidgetPositionPreference.EXACT]
            })
        };

        editorRef.current.addContentWidget(widget);
        remoteCursors.current[user] = widget;
    };

    // --- UPDATED: AUTO-RECONNECT LOGIC ADDED HERE ---
    useEffect(() => {
        if (!username) {
            toast.error("Username is required");
            navigate('/');
            return;
        }

        let reconnectTimeout;

        const connectToSocket = () => {
            if (isConnected.current) return;

            const socket = new SockJS('http://localhost:8080/ws');
            const client = Stomp.over(socket);
            client.debug = () => {}; 
            
            client.connect({}, () => {
                stompClient.current = client;
                isConnected.current = true;
                
                // If this is a reconnect, clear the typing timeout just in case
                clearTimeout(reconnectTimeout);

                client.subscribe(`/topic/code/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    if (!isLocalChange.current) {
                        setCode(body.content);
                        if (body.language && body.language !== language) setLanguage(body.language);
                    }
                    isLocalChange.current = false;
                });

                client.subscribe(`/topic/users/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    setUsers(body.activeUsers);
                    if (body.type === "JOIN" && body.username !== username) toast.success(`${body.username} joined`);
                    if (body.type === "LEAVE") toast(`${body.username} left`);
                });

                client.subscribe(`/topic/chat/${roomId}`, (msg) => {
                    setMessages(prev => [...prev, JSON.parse(msg.body)]);
                });

                client.subscribe(`/topic/typing/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    if (body.username !== username) {
                        setTypingUsers(prev => {
                            const newSet = new Set(prev);
                            if (body.isTyping === 'true') newSet.add(body.username);
                            else newSet.delete(body.username);
                            return Array.from(newSet);
                        });
                    }
                });

                client.subscribe(`/topic/cursor/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    updateRemoteCursor(body.username, { lineNumber: body.lineNumber, column: body.column });
                });

                client.send(`/app/room/${roomId}/join`, {}, JSON.stringify({ username, type: "JOIN" }));
            }, (err) => {
                console.warn("WebSocket disconnected. Server might be restarting. Retrying in 3 seconds...");
                isConnected.current = false;
                stompClient.current = null;
                // Auto-reconnect after 3 seconds
                reconnectTimeout = setTimeout(connectToSocket, 3000);
            });
        };

        connectToSocket();

        return () => {
            clearTimeout(reconnectTimeout);
            if (stompClient.current?.connected) {
                stompClient.current.send(`/app/room/${roomId}/leave`, {}, JSON.stringify({ username, type: "LEAVE" }));
                stompClient.current.disconnect();
            }
            isConnected.current = false;
        };
    }, [roomId, username, navigate, language]);

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, typingUsers]);

    const handleLanguageSelect = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        const newCode = CODE_SNIPPETS[newLang];
        setCode(newCode);

        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, content: newCode, language: newLang, type: "CODE" }));
        }
    };

    const handleTypingChange = (e) => {
        setChatMsg(e.target.value);
        
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'true' }));
            
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                if (stompClient.current?.connected) {
                    stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'false' }));
                }
            }, 1500);
        }
    };

    const sendChat = () => {
        if (chatMsg.trim() && stompClient.current?.connected) {
            const payload = { sender: username, content: chatMsg };
            stompClient.current.send(`/app/chat/${roomId}`, {}, JSON.stringify(payload));
            setChatMsg("");
            
            clearTimeout(typingTimeoutRef.current);
            stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'false' }));
        }
    };

    const handleEditorChange = (value) => {
        if (stompClient.current?.connected) {
            isLocalChange.current = true;
            setCode(value);
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, content: value, language, type: "CODE" }));
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

    const downloadCode = () => {
        const extensionMap = { "java": "java", "python": "py", "cpp": "cpp" };
        const blob = new Blob([code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Vylop_${roomId}.${extensionMap[language] || "txt"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Downloaded!");
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        toast.success("Room ID Copied");
    };

    return (
        <div className="app-container">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
            
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="brand-logo">
                        <span className="brand-prompt">&gt;</span>
                        <span>Vylop</span>
                        <span className="brand-cursor"></span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setIsSidebarOpen(false)} style={{padding: '4px 8px'}}>✕</button>
                </div>

                <div className="user-list">
                    <div className="section-title">Online ({users.length})</div>
                    {users.map((u, i) => <Client key={i} username={u} />)}
                </div>

                <div className="chat-area">
                    <div className="chat-messages" ref={chatContainerRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`message ${msg.sender === username ? 'self' : 'other'}`}>
                                <span className="msg-meta">{msg.sender}</span>
                                <div className="msg-bubble">{msg.content}</div>
                            </div>
                        ))}
                    </div>
                    
                    {typingUsers.length > 0 && (
                        <div style={{ padding: '0 15px 5px', fontSize: '0.75rem', color: '#8b949e', fontStyle: 'italic', animation: 'fadeIn 0.3s' }}>
                            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                        </div>
                    )}

                    <div className="chat-input-area">
                        <input 
                            className="modern-input"
                            value={chatMsg}
                            onChange={handleTypingChange} 
                            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                            placeholder="Type a message..."
                        />
                        <button className="btn btn-icon" onClick={sendChat}>➤</button>
                    </div>
                </div>

                <div className="sidebar-header" style={{borderTop: '1px solid var(--border)'}}>
                    <button className="btn btn-secondary" style={{flex:1, marginRight: '10px'}} onClick={copyRoomId}>Copy ID</button>
                    <button className="btn btn-danger" style={{flex:1}} onClick={() => navigate('/')}>Leave</button>
                </div>
            </div>

            <div className="main-area">
                <div className="toolbar">
                    <div className="toolbar-group">
                        <button className="btn btn-secondary" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
                        <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{roomId}</span>
                    </div>
                    <div className="toolbar-group">
                        <select className="lang-select" value={language} onChange={handleLanguageSelect}>
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                        </select>
                        <button className="btn btn-secondary" onClick={downloadCode} title="Download">⬇</button>
                        <button className="btn btn-primary" onClick={runCode} disabled={isRunning}>
                            {isRunning ? "Running..." : "▶ Run Code"}
                        </button>
                    </div>
                </div>

                <Split 
                    className={`editor-split ${splitDirection}`}
                    sizes={[70, 30]} 
                    minSize={250}    
                    gutterSize={8}
                    direction={splitDirection} 
                >
                    <div className="editor-wrapper">
                        <Editor 
                            height="100%" 
                            language={language === "cpp" ? "cpp" : language} 
                            theme="vs-dark" 
                            value={code} 
                            onMount={handleEditorDidMount} 
                            onChange={handleEditorChange} 
                            options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', automaticLayout: true }} 
                        />
                    </div>
                    
                    <div className="io-wrapper">
                        <div className="io-container">
                            <div className="io-header">
                                <span>STDIN (Input)</span>
                            </div>
                            <textarea 
                                className="terminal-input" 
                                value={userInput} 
                                onChange={(e) => setUserInput(e.target.value)} 
                                placeholder="Enter input here..."
                            />
                        </div>
                        <div className="io-container" style={{borderTop: '1px solid var(--border)'}}>
                            <div className="io-header">
                                <span>STDOUT (Output)</span>
                                <button className="btn btn-secondary" style={{fontSize: '0.7rem', padding: '2px 6px'}} onClick={() => setOutput("")}>Clear</button>
                            </div>
                            <pre className="terminal-output">{output || "Run code to see output..."}</pre>
                        </div>
                    </div>
                </Split>
            </div>
        </div>
    );
};

export default CodeEditor;