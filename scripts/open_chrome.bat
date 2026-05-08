@echo off
echo Opening Chrome with remote debugging on port 9222...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%~dp0..\.chrome-profile"
echo.
echo Chrome opened. Visit https://otrucking.com/carrier/ once and pass any
echo Cloudflare check so the cookies are saved in this profile.
echo Then run: npm run scrape:otrucking
pause
