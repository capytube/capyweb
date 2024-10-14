// src/components/SignOutButton.tsx

interface SignOutButtonProps {
  signOut?: () => void; // Just use an optional signOut function
}

const SignOutButton: React.FC<SignOutButtonProps> = ({ signOut }) => {
  return (
    <button
      onClick={() => signOut && signOut()} // Ensure signOut is defined before calling it
      className="text-white bg-red-500 hover:bg-red-700 p-1 w-20 rounded-md"
    >
      Sign Out
    </button>
  );
};

export default SignOutButton;
