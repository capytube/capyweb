// src/components/ProfilePage.tsx

import React, { useEffect, useState } from 'react';

import { PencilIcon } from './Icons';

import NftSection from './NftSection';
import WalletSection from './WalletSection/WalletSection';
import Footer from '../Footer/Footer';
import NotLoggedInPage from './NoLoginPage/NotLoggedInPage';
import NotPremiumPage from './NotPremium/NotPremiumPage';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAccount } from 'wagmi';

interface UserProfile {
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

const ProfilePage: React.FC = () => {
  const isLoggedIn = useIsLoggedIn();
  const { isConnected } = useAccount();

  console.log('isLoggedIn', isLoggedIn);

  const [user, setUser] = useState<UserProfile | null>(null);
  // const [premium] = React.useState(false);

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

  return isLoggedIn ? (
    isConnected ? (
      <>
        <div className="bg-grassGreen lg:py-10 py-8">
          <h1 className="font-hanaleiFill text-darkGreen md:text-titleSize text-titleSizeSM text-center md:pb-6 pb-4">
            My Account
          </h1>
          <form className="flex md:flex-row flex-col gap-x-6 gap-y-6 justify-center p-6">
            <div className="flex flex-col gap-y-2">
              <label
                htmlFor="displayName"
                className="text-chocoBrown font-ADLaM sm:text-xl text-xs"
              >
                Display name:
              </label>
              <div className="flex gap-x-4 items-center">
                <input
                  name="displayName"
                  type="text"
                  className="border-2 border-chocoBrown rounded-[4px] outline-none px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:min-w-[316px] lg:max-w-[316px] max-w-[266px]"
                />
                <PencilIcon />
              </div>
            </div>
          </form>
        </div>
        <NftSection />
        <WalletSection premium={isConnected} />
        {!isMobile && <Footer />}
      </>
    ) : (
      <>
        <NotPremiumPage />
        {!isMobile && <Footer />}
      </>
    )
  ) : (
    <>
      <NotLoggedInPage />
      {!isMobile && <Footer />}
    </>
  );
};

export default ProfilePage;
