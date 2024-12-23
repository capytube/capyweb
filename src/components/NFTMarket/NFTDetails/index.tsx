import { Link, useParams } from 'react-router-dom';
import { LeftArrowIcon } from '../../Icons/Icons';
import NFTDetailsCard from './DetailsCard';
import NftDetails from './NftDetails';
import { useEffect, useState } from 'react';
import Footer from '../../Footer/Footer';
import { getNftById } from '../../../api/nft';
import { NftAtomType } from '../../../store/atoms/nftAtom';

export default function Index() {
  const { id } = useParams<{ id: string }>();

  // states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const [isFetchingDataLoading, setIsFetchingDataLoading] = useState(false);
  const [nftData, setNftData] = useState<NftAtomType | null>(null);

  // functions
  const handleScrollTop = () => {
    const ele = document.getElementById('details-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // effects
  useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchNFTdataById = async (id: string) => {
      setIsFetchingDataLoading(true);
      await getNftById({ id })
        .then((res) => {
          setIsFetchingDataLoading(false);
          if (res?.data) {
            setNftData(res?.data);
          }
        })
        .catch(() => {
          setIsFetchingDataLoading(false);
        });
    };
    if (id) {
      fetchNFTdataById(id);
    }
  }, []);

  return (
    <>
      <header id="shop-nft-section" className="py-10"></header>
      <div id="details-section" className="lg:pb-20 lg:pt-10 py-8 px-4 lg:px-40 ">
        <Link
          to="/shop"
          className="flex md:gap-x-4 gap-x-3 md:text-2xl text-base text-chocoBrown font-commissioner items-center md:pb-10 pb-6 w-fit"
        >
          <LeftArrowIcon />
          Back
        </Link>
        {!isFetchingDataLoading && Object.keys(nftData ?? {})?.length > 0 ? (
          <div className="flex lg:flex-row flex-col gap-y-10 gap-x-12 lg:justify-start justify-center lg:items-start items-center">
            <NFTDetailsCard data={nftData} />
            <NftDetails data={nftData} />
          </div>
        ) : (
          <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center">
            loading...
          </div>
        )}
      </div>
      {!isMobile && <Footer />}
    </>
  );
}
