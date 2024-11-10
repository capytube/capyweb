// src/components/ProfilePage.tsx

import React, { useEffect, useState } from 'react';

import { PencilIcon } from './Icons';

import NftSection from './NftSection';
import WalletSection from './WalletSection';
import Footer from '../Footer/Footer';

interface UserProfile {
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Simulate fetching user data from an API (or use AWS Cognito to fetch user attributes)
  useEffect(() => {
    // Replace with real data fetching logic
    const fetchUserData = async () => {
      // Simulate an API call
      const userData: UserProfile = {
        username: 'johndoe',
        email: 'johndoe@example.com',
        fullName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.png', // Optional avatar
      };
      setUser(userData);
    };

    fetchUserData();
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    // <div className="profile-page-container" style={profilePageStyles.container}>
    //   <div>
    //     <h1>Profile Page</h1>

    //     {/* Avatar */}
    //     {user.avatarUrl && <img src={user.avatarUrl} alt="User Avatar" />}

    //     {/* Display User Info */}
    //     <div style={profilePageStyles.infoSection}>
    //       <h2>{user.fullName}</h2>
    //       <p>
    //         <strong>Username:</strong> {user.username}
    //       </p>
    //       <p>
    //         <strong>Email:</strong> {user.email}
    //       </p>
    //     </div>

    //     {/* Action Buttons */}
    //     <div style={profilePageStyles.actionButtons}>
    //       <button
    //         style={profilePageStyles.button}
    //         onClick={() => alert("Edit profile clicked!")}
    //       >
    //         Edit Profile
    //       </button>
    //       <button
    //         style={profilePageStyles.button}
    //         onClick={() => alert("Log out clicked!")}
    //       >
    //         Log Out
    //       </button>
    //     </div>
    //   </div>
    // </div>
    <div>
      <div className="bg-grassGreen lg:py-10 py-8">
        <h1 className="font-hanaleiFill text-darkGreen md:text-titleSize text-titleSizeSM text-center md:pb-6 pb-4">
          My Account
        </h1>
        <form className="flex md:flex-row flex-col gap-x-6 gap-y-6 justify-center p-6">
          {[
            { name: 'displayName', title: 'Display name' },
            {
              name: 'walletAddress',
              title: 'Wallet address',
            },
          ]?.map((field: { name: string; title: string }) => (
            <div key={field?.name} className="flex flex-col gap-y-2">
              <label
                htmlFor={field?.name}
                className="text-chocoBrown font-ADLaM sm:text-xl text-xs"
              >
                {field?.title}:
              </label>
              <div className="flex gap-x-4 items-center">
                <input
                  name={field?.name}
                  type="text"
                  className="border-2 border-chocoBrown rounded-[4px] outline-none px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:min-w-[316px] lg:max-w-[316px] max-w-[266px]"
                />
                <PencilIcon />
              </div>
            </div>
          ))}
        </form>
      </div>
      <NftSection />
      <WalletSection />
      {!isMobile && <Footer />}
    </div>
  );
};

// Basic styles for the profile page
// const profilePageStyles = {
//   container: {
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center',
//     height: '100vh',
//     backgroundColor: '#f9f9f9',
//   },
//   card: {
//     width: '400px',
//     padding: '20px',
//     borderRadius: '8px',
//     backgroundColor: '#fff',
//     boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
//     textAlign: 'center',
//   },
//   avatar: {
//     width: '100px',
//     height: '100px',
//     borderRadius: '50%',
//     objectFit: 'cover',
//     marginBottom: '20px',
//   },
//   infoSection: {
//     marginBottom: '20px',
//   },
//   actionButtons: {
//     display: 'flex',
//     justifyContent: 'space-between',
//   },
//   button: {
//     padding: '10px 20px',
//     borderRadius: '4px',
//     backgroundColor: '#007BFF',
//     color: '#fff',
//     border: 'none',
//     cursor: 'pointer',
//     fontSize: '16px',
//   },
// };

export default ProfilePage;
