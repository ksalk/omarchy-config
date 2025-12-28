# Google Fit Step Count

A script to fetch daily and 7-day average step counts from the Google Fit API and save the output to a text file.

## Prerequisites

- Node.js
- npm

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Create Environment File:**
    Create a file named `.env` in the root of the project and add the following variables:

    ```
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REFRESH_TOKEN=
    OUTPUT_FILE_PATH=
    ```

## Configuration

### Environment Variables

-   `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Your Google application credentials. You can get these from the [Google Cloud Platform Console](https://console.cloud.google.com/).
    - You must create an OAuth 2.0 Client ID.
    - Add `http://localhost:3000` to your "Authorized redirect URIs".
-   `GOOGLE_REFRESH_TOKEN`: This token is required to run the script automatically without manual authentication each time. See the usage section below for how to obtain it.
-   `OUTPUT_FILE_PATH` (Optional): The absolute path where the step count text file will be saved. If left blank, it will default to `step-count.txt` in the `dist/` directory.

### Getting a Refresh Token

This script includes a command to help you get the `GOOGLE_REFRESH_TOKEN`. This is a **one-time setup** step.

1.  Make sure your Client ID, Client Secret, and Redirect URI are correctly set up in both your `.env` file and the Google Cloud Console.
2.  Run the following command:
    ```bash
    npm start get-refresh-token
    ```
3.  Follow the instructions in the console, which will ask you to visit a URL in your browser to authorize the application.
4.  After authorization, the refresh token will be printed in your console. Copy this value and paste it into the `GOOGLE_REFRESH_TOKEN` field in your `.env` file.

## Usage

Once setup and configuration are complete, you can run the script manually:

```bash
npm start
```

This will compile the TypeScript, fetch the data, and save it to your output file.

## Setting up Timed Background Jobs

To run this script periodically, you can use `systemd` (recommended) or `cron`.

### Option 1: systemd Timer (Recommended)

1.  **Create `google-fit-stepcount.service`:**
    ```ini
    [Unit]
    Description=Fetch Google Fit step count data

    [Service]
    Type=oneshot
    WorkingDirectory=/home/ksalk/dev/google-fit-stepcount
    ExecStart=/home/ksalk/.config/nvm/versions/node/v24.6.0/bin/npm start
    ```

2.  **Create `google-fit-stepcount.timer`:**
    ```ini
    [Unit]
    Description=Run the Google Fit step count script every 10 minutes

    [Timer]
    OnBootSec=1min
    OnUnitActiveSec=10min
    Unit=google-fit-stepcount.service

    [Install]
    WantedBy=timers.target
    ```

3.  **Install and Enable:**
    Place these two files in `~/.config/systemd/user/` and run the following commands:
    ```bash
    # Reload the systemd daemon to recognize the new files
    systemctl --user daemon-reload

    # Enable and start the timer
    systemctl --user enable --now google-fit-stepcount.timer

    # Check the status of your timer
    systemctl --user status google-fit-stepcount.timer
    ```

4.  **Checking Logs:**
    To see the script's output and any potential errors, use `journalctl`:
    ```bash
    # Follow the logs in real-time
    journalctl --user -u google-fit-stepcount.service -f
    ```

### Option 2: cron Job

You can add the following lines to your crontab by running `crontab -e`.

```crontab
# Run on system startup
@reboot /home/ksalk/.config/nvm/versions/node/v24.6.0/bin/npm --prefix /home/ksalk/dev/google-fit-stepcount start

# Run every 10 minutes
*/10 * * * * /home/ksalk/.config/nvm/versions/node/v24.6.0/bin/npm --prefix /home/ksalk/dev/google-fit-stepcount start
```
