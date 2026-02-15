import React from 'react';

const Client = ({ username }) => {
    // Generate a consistent color based on the username
    const stringToColor = (string) => {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 70%, 50%)`;
    };

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '15px', 
            gap: '12px',
            padding: '5px 10px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.03)'
        }}>
            {/* Custom Avatar Circle */}
            <div style={{
                width: '35px',
                height: '35px',
                borderRadius: '10px',
                backgroundColor: stringToColor(username),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                textTransform: 'uppercase'
            }}>
                {username.charAt(0)}
            </div>
            
            <span style={{ 
                fontSize: '0.9rem', 
                fontWeight: '500', 
                color: '#e0e0e0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            }}>
                {username}
            </span>
        </div>
    );
};

export default Client;