document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/login-attempts');
      const data = await response.json();
      
      if (data.blocked) {
        document.getElementById('blockedContent').style.display = 'block';
        document.getElementById('attemptContent').style.display = 'none';
        
        let timeLeft = 15 * 60;
        const countdownElement = document.getElementById('countdown');
        
        const updateCountdown = () => {
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          countdownElement.textContent = `Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before trying again`;
          
          if (timeLeft > 0) {
            timeLeft--;
            setTimeout(updateCountdown, 1000);
          } else {
            countdownElement.textContent = 'You can now try logging in again';
          }
        };
        
        updateCountdown();
      } else {
        document.getElementById('attemptContent').style.display = 'block';
        document.getElementById('blockedContent').style.display = 'none';
        document.getElementById('attemptNum').textContent = data.attempts || 1;
      }
    } catch (error) {
      console.error('Error fetching login attempts:', error);
      document.getElementById('attemptContent').style.display = 'block';
      document.getElementById('blockedContent').style.display = 'none';
    }
  });
