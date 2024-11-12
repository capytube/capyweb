import LoginSection from './LoginSection';
import NftSection from './NftSection';

type Props = {};

export default function NotLoggedInPage({}: Props) {
  return (
    <>
      <LoginSection />
      <NftSection clx="!pb-20" />
    </>
  );
}
