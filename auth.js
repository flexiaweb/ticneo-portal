// auth.js - Control de Acceso y Sesión

// Manejar Inicio de Sesión desde login.html
function handleLogin(e) {
    e.preventDefault();
    
    const userInput = document.getElementById('username').value.trim();
    const passInput = document.getElementById('password').value;
  
    // Guardar temporalmente las credenciales en la sesión del navegador
    sessionStorage.setItem('ticneo_user', userInput);
    sessionStorage.setItem('ticneo_pass', passInput);
  
    // Intentar acceder directamente a la página principal
    window.location.href = 'index.html';
  }
  
  // Proteger páginas privadas
  function checkAuth() {
    const user = sessionStorage.getItem('ticneo_user');
    const pass = sessionStorage.getItem('ticneo_pass');
    const isLoginPage = window.location.pathname.endsWith('login.html');
  
    if ((!user || !pass) && !isLoginPage) {
      window.location.href = 'login.html';
    }
  }
  
  // Cerrar Sesión
  function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
  
  // Verificar autenticación automáticamente
  if (!window.location.pathname.endsWith('login.html')) {
    checkAuth();
  }