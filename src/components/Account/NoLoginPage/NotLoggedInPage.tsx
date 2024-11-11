import LoginSection from './LoginSection';
import NftSection from './NftSection';

type Props = {
  setLoggedIn: Function;
};

export default function NotLoggedInPage({ setLoggedIn }: Props) {
  return (
    <>
      <LoginSection setLoggedIn={setLoggedIn} />
      <NftSection clx="pb-20" />
    </>
  );
}
