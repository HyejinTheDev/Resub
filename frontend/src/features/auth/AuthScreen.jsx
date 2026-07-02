import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { API_BASE_URL } from '../../shared/config/constants';

export default function AuthScreen({ onClose }) {
  const { setCurrentUser } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  // Fetch Google client configuration
  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/google-config`)
      .then(res => res.json())
      .then(data => {
        if (data.clientId) {
          setGoogleClientId(data.clientId);
        }
      })
      .catch(err => console.error('Failed to load Google config:', err));
  }, []);

  // Initialize and render Google button when SDK and Client ID are loaded
  useEffect(() => {
    if (!googleClientId) return;

    const initializeGoogleSignIn = () => {
      /* global google */
      if (typeof google !== 'undefined') {
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleLogin
          });
          google.accounts.id.renderButton(
            document.getElementById("google-signin-btn"),
            { 
              theme: "filled_blue", 
              size: "large", 
              width: 340, 
              text: "continue_with",
              shape: "rectangular"
            }
          );
        } catch (err) {
          console.error('Error rendering Google button:', err);
        }
      }
    };

    const interval = setInterval(() => {
      if (typeof google !== 'undefined') {
        initializeGoogleSignIn();
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [googleClientId, isLogin]);

  const handleGoogleLogin = async (response) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google Login failed');
      }

      setCurrentUser(data.user);
    } catch (err) {
      setError(`Đăng nhập Google thất bại: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp!');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đã có lỗi xảy ra!');
      }

      setCurrentUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1e202c 0%, #0c0d14 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        background: 'rgba(23, 25, 35, 0.65)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {onClose && (
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '18px',
              cursor: 'pointer',
              outline: 'none',
              padding: '4px'
            }}
            title="Đóng"
          >
            ✕
          </button>
        )}
        {/* Logo or Brand */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '2px',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block'
          }}>
            RESUB
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            margin: 0
          }}>
            Lồng Tiếng Video Trung - Việt Tự Động
          </p>
        </div>

        {/* Tab Selection */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '28px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: isLogin ? 'var(--accent, #10b981)' : 'transparent',
              color: isLogin ? '#000' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: 'bold',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '13px'
            }}
          >
            Đăng nhập
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: !isLogin ? 'var(--accent, #10b981)' : 'transparent',
              color: !isLogin ? '#000' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: 'bold',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '13px'
            }}
          >
            Đăng ký
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '20px',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '6px'
            }}>
              Tên đăng nhập
            </label>
            <input
              type="text"
              placeholder="Nhập tên tài khoản..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent, #10b981)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '6px'
            }}>
              Mật khẩu
            </label>
            <input
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent, #10b981)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
            />
          </div>

          {!isLogin && (
            <div style={{ textAlign: 'left' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '6px'
              }}>
                Nhập lại mật khẩu
              </label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent, #10b981)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--accent, #10b981)',
              color: '#000',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '10px',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #000',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Đang xử lý...
              </>
            ) : isLogin ? 'Bắt đầu trải nghiệm' : 'Đăng ký tài khoản'}
          </button>
        </form>

        {googleClientId && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0 16px 0',
              color: 'rgba(255, 255, 255, 0.25)',
              fontSize: '12px',
              fontWeight: 500
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
              <span style={{ padding: '0 10px', letterSpacing: '1px' }}>HOẶC</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div id="google-signin-btn"></div>
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
