import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { getStream } from '../functions/getStream/resource';
import { getViewership } from '../functions/getViewership/resource';

const access_type = a.enum(['public', 'private']);
const interaction_type = a.enum(['vote', 'bid']);
const transaction_type = a.enum(['tip', 'reward', 'stream_payment', 'transfer', 'withdraw', 'deposit', 'vote', 'bid']);
const rarity_level = a.enum(['ultra_rare', 'rare', 'epic']);
const gender = a.enum(['male', 'female']);

const schema = a.schema({
  Options: a.customType({
    key: a.string(),
    value: a.string(),
  }),
  Vote_Options: a.customType({
    id: a.string(),
    title: a.string(),
    description: a.string(),
  }),

  getStream: a
    .query()
    .arguments({
      streamId: a.string(),
    })
    .returns(a.string())
    .handler(a.handler.function(getStream))
    .authorization((allow) => [allow.publicApiKey()]),
  getViewership: a
    .query()
    .arguments({
      streamId: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(getViewership))
    .authorization((allow) => [allow.publicApiKey()]),

  // Interactions Table
  Interactions: a
    .model({
      id: a.id(),
      capybara_id: a.id().required(), // Foreign Key to Capybara
      capybara: a.belongsTo('Capybara', 'capybara_id'),
      interaction_type: interaction_type, // "vote" or "bid"
      title: a.string().required(), // Title of the interaction (e.g., "Vote for Snack Choice")
      title_icon_url: a.string(),
      description: a.string().required(),
      device_required: a.string(),
      image_url: a.string(),
      options: a.ref('Vote_Options').array(),
      rules: a.string().array(),
      session_date: a.date(),
      result: a.string(), // winning option ID
      vote_cost: a.integer(),
      custom_request_cost: a.integer(), // additional cost if custom request
      current_bid: a.integer(),
      userVotes: a.hasMany('UserVotes', 'interaction_id'),
      userBids: a.hasMany('UserBids', 'interaction_id'),
    })
    .secondaryIndexes((index) => [index('capybara_id').name('CapybaraInteractionIndex').sortKeys(['interaction_type'])])
    .authorization((allow) => [allow.publicApiKey()]),

  // UserVotes schema
  UserVotes: a
    .model({
      id: a.id(),
      interaction_id: a.id().required(), // Foreign Key to the Interactions Table
      interaction: a.belongsTo('Interactions', 'interaction_id'),
      user_id: a.id().required(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      option_id: a.id(), // ID of the option the user voted for
      number_of_votes: a.integer(), // Number of votes purchased
      cost: a.integer(), // Total cost (including extra cost for custom votes)
      is_custom_request: a.boolean(), // Whether the vote is for a custom option
      custom_request: a.string(), // custom request string
      approved: a.boolean(), // Whether the custom request is approved (if applicable)
      tokenTransaction: a.hasOne('TokenTransaction', 'related_id'),
    })
    .secondaryIndexes((index) => [index('interaction_id').name('InteractionTypeIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // UserBids schema
  UserBids: a
    .model({
      id: a.id(),
      interaction_id: a.id().required(), // Foreign Key to the Interactions Table
      interaction: a.belongsTo('Interactions', 'interaction_id'),
      user_id: a.id().required(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      bid_amount: a.integer(),
      tokenTransaction: a.hasOne('TokenTransaction', 'related_id'),
    })
    .secondaryIndexes((index) => [index('interaction_id').name('InteractionTypeIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // TokenTransaction schema
  TokenTransaction: a
    .model({
      id: a.id(),
      user_id: a.id().required(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      transaction_type: transaction_type,
      amount: a.integer(), // Transaction amount in tokens
      related_id: a.id(), // Can reference UserVotes or UserBids
      related_type: interaction_type,
      relatedVote: a.belongsTo('UserVotes', 'related_id'),
      relatedBid: a.belongsTo('UserBids', 'related_id'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // ChatComments schema
  ChatComments: a
    .model({
      id: a.id(),
      stream_id: a.id().required(), // Foreign Key to LiveStream
      stream: a.belongsTo('LiveStream', 'stream_id'),
      user_id: a.id().required(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      content: a.string().required(), // the comment text content
    })
    .secondaryIndexes((index) => [index('stream_id').name('StreamCommentsIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // LiveStream schema
  LiveStream: a
    .model({
      id: a.id(),
      title: a.string().required(), // e.g. 'main cam', 'food cam'
      start_time: a.date(),
      end_time: a.date(),
      is_live: a.boolean(),
      viewer_count: a.integer(),
      capybara_ids: a.string().array().required(), // array of Capybara IDs involved in the stream
      access_type: access_type,
      price_per_10_sec: a.integer(),
      s3_video_address: a.string(), // S3 bucket URL address for playing custom stream
      streaming_address: a.string(), // livepeer address for the live stream (if available)
      ratingCounts: a.customType({
        capylove: a.integer(),
        capylike: a.integer(),
        capywow: a.integer(),
        capyangry: a.integer(),
        capyfire: a.integer(),
      }),
      chatComments: a.hasMany('ChatComments', 'stream_id'),
    })
    .secondaryIndexes((index) => [index('access_type').name('AccessTypeIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // Capybara schema
  Capybara: a
    .model({
      id: a.id(),
      name: a.string().required(),
      gender: gender,
      birth_date: a.date(),
      born_place: a.string(),
      description: a.string(), // can be in Markdown format
      bio: a.string(), // can be in Markdown format
      personality: a.string(), // can be in Markdown format
      card_image_url: a.string(),
      avatar_image_url: a.string(),
      profile_image_url: a.string(),
      favorite_activities: a.string().array(),
      fun_fact: a.string(), // can be in Markdown format
      interactions: a.hasMany('Interactions', 'capybara_id'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // User schema
  User: a
    .model({
      id: a.id(),
      username: a.string().required(),
      email: a.string().required(),
      profile_image_url: a.string(),
      wallet_address: a.string(),
      bio: a.string(),
      balance: a.integer(), // total capycoin balance in the account
      totalWatchTime: a.integer(), // Total watch time in seconds
      userVotes: a.hasMany('UserVotes', 'user_id'),
      userBids: a.hasMany('UserBids', 'user_id'),
      tokenTransaction: a.hasMany('TokenTransaction', 'user_id'),
      chatComments: a.hasMany('ChatComments', 'user_id'),
      nftOwned: a.hasMany('NFT', 'owner_id'),
      offers: a.hasMany('Offers', 'from'),
      sellerActivityLog: a.hasMany('ActivityLog', 'from'),
      buyerActivityLog: a.hasMany('ActivityLog', 'to'),
    })
    .secondaryIndexes((index) => [index('wallet_address').name('ByWalletAddress').queryField('getUserByWalletAddress')])
    .authorization((allow) => [allow.publicApiKey()]),

  // NFT schema
  NFT: a
    .model({
      id: a.id(), // Unique Token ID (e.g., "NFT1234")
      name: a.string().required(), // Name of the NFT (e.g., "Capy #1234")
      image_url: a.string(),
      rarity: rarity_level, // Rarity level (e.g., "ultra rare", "rare", "epic")
      labels: a.string().array(), // Labels for categorization (e.g., "Capybara", "Chalk Bonus")
      properties: a.ref('Options').array(), // List of properties (e.g., "Chalk powder bonus")
      price: a.integer(), // Current price of the NFT
      is_for_sale: a.integer(), // possible values 0 or 1 (1 represent NFT is currently for sale)
      owner_id: a.id(), // User ID of the current owner (nullable if listed for sale)
      owner_details: a.belongsTo('User', 'owner_id'),
      offers: a.hasMany('Offers', 'nftId'),
      activityLog: a.hasMany('ActivityLog', 'nftId'),
    })
    .secondaryIndexes((index) => [index('is_for_sale').name('ForSaleIndex'), index('owner_id').name('OwnerIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // Offers Schema
  Offers: a
    .model({
      id: a.id(),
      price: a.integer().required(), // Offered price for NFT
      from: a.id().required(), // User ID of the user making the offer
      expires_at: a.date(), // Expiration date of the offer
      nftId: a.id().required(), // Foreign key to the NFT
      nftDetails: a.belongsTo('NFT', 'nftId'),
      fromDetails: a.belongsTo('User', 'from'),
    })
    .secondaryIndexes((index) => [index('nftId').name('OfferNftIdTypeIndex').queryField('listOffersByNftId')])
    .authorization((allow) => [allow.publicApiKey()]),

  // ActivityLog Schema
  ActivityLog: a
    .model({
      id: a.id(),
      event: a.string().required(), // Type of event (e.g., "Sale", "Transfer")
      price: a.integer().required(), // Price associated with the event
      royalties: a.string(), // (e.g., “Paid”)
      from: a.id().required(), // User ID of the seller or previous owner
      to: a.id().required(), // User ID of the buyer or new owner
      timestamp: a.date(), // Time of the event
      nftId: a.id().required(), // Foreign key to the NFT
      nftDetails: a.belongsTo('NFT', 'nftId'),
      fromDetails: a.belongsTo('User', 'from'),
      toDetails: a.belongsTo('User', 'to'),
    })
    .secondaryIndexes((index) => [index('nftId').name('LogNtfIdTypeIndex').queryField('listActivityLogsByNftId')])
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
