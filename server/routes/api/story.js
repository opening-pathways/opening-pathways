 'use strict';
/**
 * Developed by Engagement Lab, 2019
 * ==============
 * Route to create a story or retrieve all story data
 * @class api
 * @author Johnny Richardson
 *
 * ==========
 */
const keystone = global.keystone,
	  Story = keystone.list('Story'),
	  Pathway = keystone.list('Pathway'),
	  Pushover = require('node-pushover');

var getAdjacent = async (results, res, pathwayId) => {

	// Get all stories in this story's pathway
	let allStoriesQ = Pathway.model.findOne({slug: pathwayId}, 'name stories -_id')
	
	// Get one next/prev story from selected story's submit date
	let nextPrevStory = allStoriesQ.populate({
		path: 'stories', 
		select: 'name slug submitDate -_id',
		match: {submitDate : {$ne: results.submitDate}, published: true}
	}).sort({submitDate: -1});
		
	try {
		
		let nextPrevStoryExec = await nextPrevStory.lean().exec();
 
		let output = {story: results, all: nextPrevStoryExec};
		res.json(output);

	} catch (e) {
		console.error(e)
		res.status(500).send({error:e});
	}

}

var buildData = async (res, id, pathwayId, featured) => {

	let storyFields = 'name	pathway	why what how lessonsLearned vision links.html submitDate -_id';
	let query = !id ? {published: true} : {slug: id};

	if(featured)
		query.featured = true;
		
	let data = null;
	
	if(id)
		data = Story.model.findOne(query, storyFields);
	else 
		data = Story.model.find(query, 'name slug -_id').sort({ submitDate: -1 });

	try {

		let result = await data.lean().exec();
		// console.log(result)
		if(id && pathwayId)
			getAdjacent(result, res, pathwayId)
		else
			res.json(result);

	} catch (e) {
		res.status(500).json({
			e
		});
	}

};

/*
* Get published stories
*/
exports.all = function (req, res) {

	return buildData(res);

}

/*
* Get featured stories
exports.featured = function (req, res) {
	
	return buildData(res, null, true);
	
}
*/

/*
* Get story by slug id
*/
exports.get = function (req, res) {

	return buildData(res, req.params.id);

}

/*
* Get story by slug id and retrive adjacent stories via its pathway
*/
exports.pathway = function (req, res) {

	return buildData(res, req.params.id, req.params.pathway);

}

/**
 * Create a story submission
 */
exports.create = function(req, res) {
	
	// Add today's date
    const data = Object.assign(req.body, {submitDate: Date.now()}),
		  item = new Story.model(data);

	item.getUpdateHandler(req).process(data, function(err) {
		
		if (err)
			return res.status(500).send({code: err.detail.code});
		
		res.apiResponse({
			result: item
		});
		
		let push = new Pushover({
			token: process.env.PUSHOVER_KEY_APP,
			user: process.env.PUSHOVER_KEY_USER
		});

		// Send Pushover message
		push.send('Patient Story Submission', 'A new story was submitted to Opening Pathways\' patient site. Review and edit/approve here: https://partner.openingpathways.org/cms/stories/' + item._id, 
		(err, result) => {
			if(err)
				console.error('Cannot send push.', err.stack)
			else
				console.log('Message sent.');
				
		});
		
	});
}

/**
 * Get all story submission fields for form
 */
exports.fields = async (req, res) => {
 
	let StoryField = keystone.list('StoryField');
	let data = StoryField.model.find({}, 'prompt note required order mapping halfSize -_id').sort({ order: 1 });

	try {
		let result = await data.lean().exec();
		res.json(result);
	} catch (e) {
		res.status(500).json({
			e
		});
	}
}
