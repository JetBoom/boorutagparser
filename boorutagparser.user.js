// ==UserScript==
// @name         Booru Tag Parser
// @namespace    http://above.average.website
// @version      1.0.6
// @description  Copy current post tags and rating on boorus and illustration2vec in to the clipboard for easy import in to a program or another booru.
// @author       William Moodhe
// @downloadURL  https://github.com/JetBoom/boorutagparser/raw/master/boorutagparser.user.js
// @updateURL    https://github.com/JetBoom/boorutagparser/raw/master/boorutagparser.user.js

// Illustration2Vec
// @include      *demo.illustration2vec.net*

// Catch-all for boorus
// @include      *booru*/post*
// @include      *booru*/*?page=post*
// @include      *booru*/?page=post

// Boorus with weird names
// @include      *rule34.xxx/index.php?page=post*
// @include      *chan.sankakucomplex.com/post/show/*
// @include      *chan.sankakucomplex.com/?tags=*
// @include      *e621.net/post/*
// @include      *konachan.com/post/*
// @include      *shimmie.katawa-shoujo.com/post/*
// @include      *rule34.paheal.net/post/*
// @include      *rule34hentai.net/post/*
// @include      *tbib.org/index.php?page=post*
// @include      *yande.re/post/*
// @include      *nhentai.net/g/*

// @run-at       document-end
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue

// ==/UserScript==
/* jshint -W097 */
'use strict';

///////

var copy_key_code = GM_getValue('copy_key_code', 221); // ] key
var copy_sound = GM_getValue('copy_sound', 'http://heavy.noxiousnet.com/boorucopy.ogg');
var iv2_confidence_rating = GM_getValue('iv2_confidence_rating', 20.0);
var attach_explicit = GM_getValue('attach_explicit', true);
var attach_gid = GM_getValue('attach_gid', true);
var div_top = GM_getValue('div_top', false);

///////

var tags_selector = 'h5, b';
var button_style = 'font:11px monospace;font-weight:0;border:1px solid black;background:#eee;color:#000;display:block;width:90%;margin:2px auto;z-index:9999;';
var div_style = 'opacity:0.2;position:fixed;width:240px;right:2px;top:2px;text-align:center;font:11px monospace;font-weight:0;border:1px solid black;background:rgba(255,255,255,0.8);z-index:9999;';

function replaceAll(str, originalstr, newstr)
{
    return str.split(originalstr).join(newstr);
}

function insertTags(tags, selector, prefix)
{
    var elements = document.querySelectorAll(selector);

    for (var i=0; i < elements.length; i++)
    {
        var element = elements[i];
        var text = element.innerHTML;
        if (text.length > 1) // Don't copy - + or ?
        {
            text = replaceAll(text, '_', ' ');
            text = replaceAll(text, '&gt;', '>');
            text = replaceAll(text, '&lt;', '<');

            tags[tags.length] = prefix+text;
        }
    }
}

function insertRating(tags, selector)
{
    var elements = document.querySelectorAll(selector);

    for (var i=0; i < elements.length; i++)
    {
        var element = elements[i];
        var text = element.innerHTML;
        text = replaceAll(text.toLowerCase().trim(), ' ', '');

        if (text.indexOf('rating:explicit') >= 0)
        {
            tags[tags.length] = 'rating:explicit';
            break;
        }
        else if (text.indexOf('rating:questionable') >= 0)
        {
            tags[tags.length] = 'rating:questionable';
            break;
        }
        else if (text.indexOf('rating:safe') >= 0)
        {
            tags[tags.length] = 'rating:safe';
            break;
        }
    }
}

function copyNHentaiTags(noRating)
{
    // nhentai has a json output we can use.
    // Which is nice because the tags are available even if viewing an individual file.
    
    var id = window.location.href.match('/g/(\\d+)/*')[1];
    if (!id)
        return;
    
    id = Number(id);
    
    fetch('http://nhentai.net/g/' + id + '/json').then(function(response) {
        return response.json();
    }).then(function(json) {
        var tags = [];

        if (json.tags)
        {
            for (var i=0; i < json.tags.length; i++)
            {
                var tagtype = json.tags[i][1];
                var tag = json.tags[i][2];

                // maintain schema consistency
                if (tagtype == 'group')
                    tagtype = 'studio';
                else if (tagtype == 'parody')
                    tagtype = 'series';
                else if (tagtype == 'artist')
                    tagtype = 'creator';

                if (tagtype != 'tag')
                    tag = tagtype + ':' + tag;

                tags[tags.length] = tag;
            }
        }

        if (attach_explicit)
            tags[tags.length] = 'rating:explicit';

        if (attach_gid && json.id)
            tags[tags.length] = 'gallery:' + json.id;

        copyTagsToClipboard(tags);
    }).catch(function(err) {
        console.log('couldn\'t get json!');
    });
}

function copyBooruTags(noRating)
{
    var tags = [];
    // Instead of having a list of boorus and their tags and tag structures I just make a big catch-all.

    // danbooru-like
    insertTags(tags, '#tag-list li.category-3 > a.search-tag', 'series:');
    insertTags(tags, '#tag-list li.category-1 > a.search-tag', 'creator:');
    insertTags(tags, '#tag-list li.category-4 > a.search-tag', 'character:');
    insertTags(tags, '#tag-list li.category-0 > a.search-tag', '');

    // lolibooru-like
    insertTags(tags, 'li.tag-type-copyright > a', 'series:');
    insertTags(tags, 'li.tag-type-author > a', 'creator:');
    insertTags(tags, 'li.tag-type-artist > a', 'creator:');
    insertTags(tags, 'li.tag-type-character > a', 'character:');
    insertTags(tags, 'li.tag-type-general > a', '');
    insertTags(tags, 'li.tag-type-studio > a', 'studio:');
    insertTags(tags, 'li.tag-type-circle > a', 'studio:');
    insertTags(tags, 'li.tag-type-medium > a', 'medium:');
    insertTags(tags, 'li.tag-type-style > a', 'medium:');
    insertTags(tags, 'li.tag-type-meta > a', 'meta:');
    insertTags(tags, 'li.tag-type-species > a', 'species:');
    insertTags(tags, 'li.tag-type-faults > a', 'fault:');

    // booru.org-like
    insertTags(tags, '#tag_list li a', '');

    // paheal-like
    insertTags(tags, 'a.tag_name', '');

    if (!noRating)
    {
        // danbooru-like
        insertRating(tags, '#post-information > ul li');

        // lolibooru-like
        insertRating(tags, '#stats > ul li');

        // booru.org-like
        insertRating(tags, '#tag_list ul');
    }

    copyTagsToClipboard(tags);
}

function insertI2VTags(tags, selector, prefix, confidenceRequired)
{
    var elements = document.querySelectorAll(selector);
    for (var i=1; i < elements.length; i++)
    {
        var element = elements[i];

        if (confidenceRequired > 0)
        {
            var confidence = element.children[3].children[0].innerHTML;
            confidence = confidence.substr(0, confidence.length - 1);
            confidence = Number(confidence);

            if (confidence < confidenceRequired)
                continue;
        }

        var tag = element.children[1].innerHTML;

        tag = replaceAll(tag, '_', ' ');

        if (prefix)
            tag = prefix + tag;

        tags[tags.length] = tag;

        if (prefix == 'rating') // only add one rating
            break;
    }
}

function copyI2VTags(confidenceRequired, noGeneral, noRating)
{
    var tags = [];

    insertI2VTags(tags, 'table#copyright_root tr', 'series:', confidenceRequired);
    insertI2VTags(tags, 'table#character_root tr', 'character:', confidenceRequired);

    if (!noGeneral)
        insertI2VTags(tags, 'table#general_root tr', '', confidenceRequired);

    if (!noRating)
        insertI2VTags(tags, 'table#rating_root tr', 'rating:', confidenceRequired);

    copyTagsToClipboard(tags);
}

function doCopyAll()
{
    control.style.opacity = '1';
    
    if (window.location.href.indexOf('nhentai.net') >= 0)
        copyNHentaiTags();
    else if (window.location.href.indexOf('illustration2vec.net') >= 0)
        copyI2VTags(iv2_confidence_rating, false);
    else
        copyBooruTags();
}

function copyTagsToClipboard(tags)
{
    GM_setClipboard(tags.join('\n'));

    var buttontext = '';

    if (tags.length > 0)
    {
        playCopySound();
        buttontext = 'copied ' +  tags.length +' tag(s)';
    }
    else
        buttontext = 'nothing to copy!';

    var button = document.querySelector('button#copytagsbutton');
    if (button)
    {
        button.innerHTML = buttontext;
        setTimeout(function(){ button.innerHTML = 'copy tags'; }, 3000);
    }
}

function doOptions()
{
    optionsArea.style.display = optionsArea.style.display == 'none' ? 'block' : 'none';
}

function doc_keyUp(e)
{
    if (e.keyCode == copy_key_code)
    {
        doCopyAll();
    }
}
document.addEventListener('keyup', doc_keyUp, false);

var elements = document.querySelectorAll(tags_selector);
for (var i=0; i < elements.length; i++)
{
    var element = elements[i];
    if (element.innerHTML == 'Tags')
    {
        element.onclick = copyBooruTags;
        break;
    }
}

if (copy_sound.length > 0)
{
    var audio = document.createElement("audio");
    audio.src = copy_sound;
    audio.preload = false;
}

function playCopySound()
{
    if (audio && copy_sound.length > 0)
        audio.play();
}

function doChangeConfidence(e)
{
    iv2_confidence_rating = Number(optionForConfidence.value);
    captionForConfidence.innerHTML = 'iv2 min confidence: ' + iv2_confidence_rating + '%';
    GM_setValue('iv2_confidence_rating', iv2_confidence_rating);
}

function doChangeCopySound(e)
{
    copy_sound = String(optionForCopySound.value);
    GM_setValue('copy_sound', copy_sound);

    if (audio)
        audio.src = copy_sound;
}

function doChangeAttachExplicit(e)
{
    attach_explicit = optionForAttachExplicit.checked;
    GM_setValue('attach_explicit', attach_explicit);
}

function doChangeAttachGID(e)
{
    attach_gid = optionForAttachGID.checked;
    GM_setValue('attach_gid', attach_gid);
}

function doChangeDivTop(e)
{
    div_top = optionForDivTop.checked;
    GM_setValue('div_top', div_top);

    if (div_top)
    {
        control.style.top = '2px';
        control.style.bottom = '';
    }
    else
    {
        control.style.top = '';
        control.style.bottom = '2px';
    }
}

var control = document.createElement('div');
control.id = 'boorutagparser';
control.setAttribute('style', div_style);
control.onmouseenter = function(e) { this.style.opacity = 1; };
control.onmouseleave = function(e) { this.style.opacity = 0.2; };
document.body.appendChild(control);

var copyButton = document.createElement('button');
copyButton.innerHTML = 'copy tags';
copyButton.id = 'copytagsbutton';
copyButton.setAttribute('style', button_style);
copyButton.onclick = doCopyAll;
control.appendChild(copyButton);

var optionsButton = document.createElement('button');
optionsButton.innerHTML = 'options';
optionsButton.id = 'optionsbutton';
optionsButton.setAttribute('style', button_style);
optionsButton.onclick = doOptions;
control.appendChild(optionsButton);

var optionsArea = document.createElement('div');
optionsArea.id = 'optionsarea';
optionsArea.setAttribute('style', 'display:none;');
control.appendChild(optionsArea);

if (window.location.href.indexOf('illustration2vec.net') >= 0)
{
    var captionForConfidence = document.createElement('span');
    captionForConfidence.id = 'captionconfidence';
    captionForConfidence.innerHTML = 'iv2 min confidence: ' + iv2_confidence_rating + '%';
    optionsArea.appendChild(captionForConfidence);

    var optionForConfidence = document.createElement('input');
    optionForConfidence.id = 'optionsconfidence';
    optionForConfidence.setAttribute('type', 'range');
    optionForConfidence.setAttribute('value', iv2_confidence_rating);
    optionForConfidence.setAttribute('min', 0);
    optionForConfidence.setAttribute('max', 100);
    optionForConfidence.onchange = doChangeConfidence;
    optionsArea.appendChild(optionForConfidence);
}

if (window.location.href.indexOf('nhentai.net/g/') >= 0)
{
    var optionForAttachExplicit = document.createElement('input');
    optionForAttachExplicit.setAttribute('type', 'checkbox');
    optionForAttachExplicit.checked = attach_explicit;
    optionForAttachExplicit.onchange = doChangeAttachExplicit;
    optionsArea.appendChild(optionForAttachExplicit);

    var captionForAttachExplicit = document.createElement('span');
    captionForAttachExplicit.innerHTML = 'add rating:explicit<br>';
    optionsArea.appendChild(captionForAttachExplicit);

    var optionForAttachGID = document.createElement('input');
    optionForAttachGID.setAttribute('type', 'checkbox');
    optionForAttachGID.checked = attach_gid;
    optionForAttachGID.onchange = doChangeAttachGID;
    optionsArea.appendChild(optionForAttachGID);

    var captionForAttachGID = document.createElement('span');
    captionForAttachGID.innerHTML = 'add gallery:id#<br>';
    optionsArea.appendChild(captionForAttachGID);
}

var captionForCopySound = document.createElement('span');
captionForCopySound.id = 'captioncopysound';
captionForCopySound.innerHTML = 'copy sound url';
optionsArea.appendChild(captionForCopySound);

var optionForCopySound = document.createElement('input');
optionForCopySound.id = 'optionssound';
optionForCopySound.setAttribute('value', copy_sound);
optionForCopySound.setAttribute('style', 'display:block;font-size:10px;width:90%;margin:1px auto;');
optionForCopySound.onchange = doChangeCopySound;
optionsArea.appendChild(optionForCopySound);

var optionForDivTop = document.createElement('input');
optionForDivTop.setAttribute('type', 'checkbox');
optionForDivTop.checked = div_top;
optionForDivTop.onchange = doChangeDivTop;
optionsArea.appendChild(optionForDivTop);

var captionForDivTop = document.createElement('span');
captionForDivTop.innerHTML = 'attach to top of page<br>';
optionsArea.appendChild(captionForDivTop);

var version = document.createElement('div');
version.innerHTML = GM_info.script.version;
version.setAttribute('style', 'font-size:8px;');
optionsArea.appendChild(version);

doChangeDivTop();
