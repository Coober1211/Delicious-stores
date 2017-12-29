const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			trim: true,
			required: "Please enter a store name!"
		},
		slug: String,
		description: {
			type: String,
			trim: true
		},
		tags: [String],
		created: {
			type: Date,
			default: Date.now
		},
		location: {
			type: {
				type: String,
				default: "Point"
			},
			coordinates: [
				{
					type: Number,
					required: "You must supply coordinates!"
				}
			],
			address: {
				type: String,
				required: "You must supply address!"
			}
		},
		photo: String,
		author: {
			type: mongoose.Schema.ObjectId,
			ref: "User",
			required: "You must supply an author."
		}
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true }
	}
);

storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    return next();
  }
  this.slug = slug(this.name);
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storeWithSlug = await this.constructor.find({ slug: slugRegEx});
  if(storeWithSlug.length) {
    this.slug = `${this.slug}-${storeWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1} } },
    { $sort: { count: -1} }
  ]);
}

storeSchema.statics.getTopStores = function() {
	return this.aggregate([
		{ $lookup: {
			from: 'reviews',
			localField: '_id',
			foreignField: 'store',
			as: 'reviews'
		}},
		{ $match: { 'reviews.1': { $exists: true } }},
		{ $addFields: {
			averageRating: { $avg: '$reviews.rating' }
		}},
		{ $sort: { averageRating: -1 }},
		{ $limit: 10 }
	])
}

// find reviews when the store _id property === reviews store property 
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store' // which field on the review?
});

function autoPopulate(next) {
	this.populate('reviews');
	next();
}

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Store', storeSchema);