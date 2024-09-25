// src/components/ProfilePage.tsx

import React, { useEffect, useState } from "react";
import "profile-page.css";

interface UserProfile {
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  // Simulate fetching user data from an API (or use AWS Cognito to fetch user attributes)
  useEffect(() => {
    // Replace with real data fetching logic
    const fetchUserData = async () => {
      // Simulate an API call
      const userData: UserProfile = {
        username: "johndoe",
        email: "johndoe@example.com",
        fullName: "John Doe",
        avatarUrl: "https://example.com/avatar.png", // Optional avatar
      };
      setUser(userData);
    };

    fetchUserData();
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-page-container" style={profilePageStyles.container}>
      <div style={profilePageStyles.card}>
        <h1>Profile Page</h1>

        {/* Avatar */}
        {user.avatarUrl && (
          <img
            src={user.avatarUrl}
            alt="User Avatar"
            style={profilePageStyles.avatar}
          />
        )}

        {/* Display User Info */}
        <div style={profilePageStyles.infoSection}>
          <h2>{user.fullName}</h2>
          <p>
            <strong>Username:</strong> {user.username}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={profilePageStyles.actionButtons}>
          <button
            style={profilePageStyles.button}
            onClick={() => alert("Edit profile clicked!")}
          >
            Edit Profile
          </button>
          <button
            style={profilePageStyles.button}
            onClick={() => alert("Log out clicked!")}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

// Basic styles for the profile page
const profilePageStyles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#f9f9f9",
  },
  card: {
    width: "400px",
    padding: "20px",
    borderRadius: "8px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
  },
  avatar: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    objectFit: "cover",
    marginBottom: "20px",
  },
  infoSection: {
    marginBottom: "20px",
  },
  actionButtons: {
    display: "flex",
    justifyContent: "space-between",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "4px",
    backgroundColor: "#007BFF",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
  },
};

export default ProfilePage;
