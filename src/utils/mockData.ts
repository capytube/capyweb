import { createCapybara } from '../api/capybara';
import { createInteractions } from '../api/interactions';
import { createLivestream } from '../api/livestream';
import { createNft } from '../api/nft';
import { createNewOffer } from '../api/offers';
import { createNewActivityLog } from '../api/activityLog';

export const handleAddCapy = async () => {
  await createCapybara({
    name: 'Magnus',
    gender: 'male',
    birth_year: 2017,
    born_place: 'Born in Bangkok, Thailand',
    description: 'Named after Magnus the climber and chess champion 🧗♟️.',
    bio: 'Watch our biggest naughty boy munching and chasing his little brother',
    personality:
      'Magnus is the softest soul in the gang. He loves being the center of attention and is happiest when he’s close to someone. Big on snuggles and endless belly rubs, Magnus just can’t get enough love!',
    card_image_url: 'pictures/capyHome/magnus.jpg',
    avatar_image_url: 'pictures/capyWatch/starringMagnus.jpg',
    profile_image_url: 'pictures/capyPlay/magnus.png',
    favorite_activities: ['Eating 🍎 (but in moderation!)'],
    fun_fact: null,
  });

  await createCapybara({
    name: 'Elon',
    gender: 'male',
    birth_year: 2022,
    born_place: 'Born in South America',
    description: 'Named after the Elon Musk, for his eccentric personality.',
    bio: 'This fearless bad boy doesn’t afraid of anything. Chatty and full of energy. A truely socialised capy.',
    personality:
      'Fearless and full of energy, Elon is always looking for his next thrill! He’s a natural daredevil, whether it’s jumping from high places or scaling fences.',
    card_image_url: 'pictures/capyHome/elon.jpg',
    avatar_image_url: 'pictures/capyWatch/starringElon.jpeg',
    profile_image_url: 'pictures/capyPlay/elon.png',
    favorite_activities: ['Exploring every nook and cranny he can find 🔍'],
    fun_fact: null,
  });

  await createCapybara({
    name: 'Einstein',
    gender: 'male',
    birth_year: 2022,
    born_place: 'South America (in a different spot from Elon!)',
    description: null,
    bio: 'The youngest and shy baby loves to plan a prison break. Brainy of the boys. The mastermind capy lord.',
    personality:
      'Einstein may be shy, but don’t let that fool you—he’s the smartest one in the gang! Although he scares easily, he’s always hatching little plans to explore and even once plotted an escape!',
    card_image_url: 'pictures/capyHome/einstein.jpg',
    avatar_image_url: 'pictures/capyWatch/starringEinstein.jpeg',
    profile_image_url: 'pictures/capyPlay/einstien.png',
    favorite_activities: null,
    fun_fact:
      'Beneath his timid shell lies a clever capybara who’s always one step ahead, ready to explore… as long as it’s safe!',
  });
};

export const handleCreateStreams = async () => {
  await createLivestream({
    title: 'Public Stream',
    is_live: true,
    capybara_ids: ['b6a9d892-fc90-411a-85b7-e57d44f89292'],
    access_type: 'public',
    price_per_10_sec: 1,
    streaming_address: 'fa7ahoikpf19u1e0',
  });

  await createLivestream({
    title: 'main cam',
    is_live: true,
    capybara_ids: ['b6a9d892-fc90-411a-85b7-e57d44f89292', '5d11e71b-a6fc-4051-97e9-5561e58477fc'],
    access_type: 'private',
    price_per_10_sec: 1,
    streaming_address: 'fa7ahoikpf19u1e0',
  });

  await createLivestream({
    title: 'food cam',
    is_live: true,
    capybara_ids: ['5d11e71b-a6fc-4051-97e9-5561e58477fc'],
    access_type: 'private',
    price_per_10_sec: 1,
    streaming_address: 'fa7ahoikpf19u1e0',
  });
};

export const handleCreatingInteractions = async () => {
  await createInteractions({
    capybara_id: 'b6a9d892-fc90-411a-85b7-e57d44f89292',
    interaction_type: 'vote',
    title: 'Buy capy a snack',
    title_icon_url: 'pictures/capyPlay/snackIcon.png',
    description: 'Vote what capy should eat today?',
    device_required: null,
    image_url: 'pictures/capyPlay/dineTable.png',
    options: [
      {
        id: '1',
        title: 'Carrots 🥕',
        description: 'Sweet crunchy baby carrots imported from Australia',
      },
      {
        id: '2',
        title: 'Pandan leaf 🌱',
        description: 'Fresh organic pandan leave tips from Chiang Mai',
      },
      {
        id: '3',
        title: 'Watermelon 🍉',
        description: 'Chilled sweet and juicy watermelon to quench the capy’s thirst  ',
      },
      {
        id: '4',
        title: 'Timothy grass 🌾',
        description: 'Luxurious grass that is exceptionally silky and aromatic ',
      },
      {
        id: '5',
        title: 'New request',
        description: '+ 20 ',
      },
    ],
    rules: [
      'Pay with your coins to join. 💰',
      'Vote for the food you would like our capybaras to eat. 😋',
      'The most voted food will be fed on the next day’s stream! 🏆',
    ],
    session_date: new Date('2024-12-20').getTime(),
    result: null,
    vote_cost: 5,
    current_bid: null,
  });

  await createInteractions({
    capybara_id: 'b6a9d892-fc90-411a-85b7-e57d44f89292',
    interaction_type: 'bid',
    title: 'Capy safari',
    title_icon_url: 'pictures/capyPlay/safariIcon.png',
    description: 'Bid for a chance to be the safari guide and explore the world of capybaras from your screen!',
    device_required: null,
    image_url: 'pictures/capyPlay/capySafari.png',
    options: null,
    rules: [
      'Pay with your coins to join. 💰',
      'Place your bid for a personalised video from Apple Vision Pro, made just for you!',
      'Win the auction and wait for the video recording to be sent your way for the unforgettable immersive experience.',
    ],
    session_date: new Date('2024-12-20').getTime(),
    result: null,
    vote_cost: null,
    current_bid: 20,
  });

  await createInteractions({
    capybara_id: 'b6a9d892-fc90-411a-85b7-e57d44f89292',
    interaction_type: 'bid',
    title: 'Capy Vision Pro',
    title_icon_url: 'pictures/capyPlay/visionIcon.png',
    description: 'Get up close and personal with the world’s cutest capybaras, right through your Apple Vision Pro!',
    device_required: '*Apple Vision Pro required for this experience',
    image_url: 'pictures/capyPlay/visionCat.png',
    options: null,
    rules: [
      'Pay with your coins to join. 💰',
      'Place your bid to control a robot car with a live camera. 🎥',
      'Win the auction and enjoy a 30-minute call where you can drive the car, chat, and interact with the capybaras up close!',
    ],
    session_date: new Date('2024-12-20').getTime(),
    result: null,
    vote_cost: null,
    current_bid: 30,
  });
};

export const handleCreatingNfts = async () => {
  await createNft({
    name: 'Capy #1234',
    image_url: 'pictures/nft/brownRat.png',
    rarity: 'ultra_rare',
    labels: ['Capybara', 'Chalk Bonus'],
    properties: [
      { key: 'Chalk powder', value: '+5 bidding bonus' },
      { key: 'Climbing gym', value: '+10 minutes bonus video call' },
    ],
    price: { unit: 5.8, usd: 100.0 },
    is_for_sale: 0,
    owner_id: null,
  });

  await createNft({
    name: 'Capy #5687',
    image_url: 'pictures/nft/pinkRat.png',
    rarity: 'rare',
    labels: ['Capybara', 'Chalk Bonus'],
    properties: [
      { key: 'Chalk powder', value: '+5 bidding bonus' },
      { key: 'Climbing gym', value: '+10 minutes bonus video call' },
    ],
    price: { unit: 6.8, usd: 120.0 },
    is_for_sale: 0,
    owner_id: null,
  });

  await createNft({
    name: 'Capy #632574',
    image_url: 'pictures/nft/slateRat.png',
    rarity: 'epic',
    labels: ['Capybara', 'Chalk Bonus'],
    properties: [
      { key: 'Chalk powder', value: '+5 bidding bonus' },
      { key: 'Climbing gym', value: '+10 minutes bonus video call' },
    ],
    price: { unit: 3.8, usd: 78.0 },
    is_for_sale: 0,
    owner_id: null,
  });
};

export const createMockOffers = async ({ nftId, userId }: { nftId: string; userId: string }) => {
  await createNewOffer({
    price: { unit: 3.2, usd: 70.0 },
    from: userId,
    expires_at: new Date('2024-12-24').getTime(),
    nftId: nftId,
  });
};

export const createMockActivityLog = async ({
  nftId,
  fromId,
  toId,
}: {
  nftId: string;
  fromId: string;
  toId: string;
}) => {
  await createNewActivityLog({
    event: 'sale',
    price: { unit: 3.3, usd: 70.0 },
    royalties: 'paid',
    from: fromId,
    to: toId,
    timestamp: new Date('2024-12-22').getTime(),
    nftId: nftId,
  });
};
