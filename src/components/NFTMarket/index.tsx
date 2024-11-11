import HeaderSection from './Header/HeaderSection';
import ListingSection from './ListingSection/ListingSection';

type Props = {};

export default function index({}: Props) {
  return (
    <>
      <HeaderSection />
      <ListingSection />
    </>
  );
}
