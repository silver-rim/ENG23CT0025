import requests
import json

url = "http://4.224.186.213/evaluation-service/register"
payload = {
    "email": "trae_agent_test@example.com",
    "name": "Trae Agent",
    "rollNo": "123456",
    "mobileNo": "9876543210",
    "githubUsername": "trae-agent",
    "accessCode": "123456"
}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
