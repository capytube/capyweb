// src/components/DeletionInstructions.tsx

import React from "react";

const DeletionInstructions: React.FC = () => {
  return (
    <div className="deletion-instructions-container">
      <h1>Account Deletion Instructions</h1>
      <p>
        If you would like to delete your CapyTube account and remove all
        associated personal data, please follow the steps outlined below.
      </p>

      <h2>Step 1: Log In to Your Account</h2>
      <p>
        Before you can delete your account, please log in to CapyTube with your
        credentials. Only logged-in users can request account deletion.
      </p>

      <h2>Step 2: Navigate to Account Settings</h2>
      <p>
        Once logged in, go to the "Account Settings" page from the user menu in
        the top-right corner of the screen.
      </p>

      <h2>Step 3: Request Account Deletion</h2>
      <p>
        In your account settings, scroll down to the "Delete Account" section.
        Click the "Delete My Account" button and confirm your request. You will
        be asked to provide your password again to confirm the deletion.
      </p>

      <h2>Step 4: Confirmation</h2>
      <p>
        Once your request is submitted, our system will process it. You will
        receive an email confirming the deletion of your account within 24
        hours. After deletion, all your personal data will be permanently
        removed from our system.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you encounter any issues while trying to delete your account or have
        additional questions, feel free to contact us at:
      </p>
      <p>Email: [Insert contact email]</p>
    </div>
  );
};

export default DeletionInstructions;
