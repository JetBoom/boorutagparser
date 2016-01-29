// ==UserScript==
// @name         Booru Tag Parser
// @namespace    http://above.average.website
// @version      1.0
// @description  Copy current post tags and rating on boorus and illustration2vec in to the clipboard for easy import in to a program or another booru.
// @author       William Moodhe

// Illustration2Vec
// @include      *demo.illustration2vec.net*

// Catch-all for boorus
// @include      *booru*/post*
// @include      *booru*/*?page=post*
// @include      *booru*/?page=post

// Boorus with weird names
// @include     *rule34.xxx/index.php?page=post*

// @run-at       document-end
// @grant        GM_setClipboard

// ==/UserScript==
/* jshint -W097 */
'use strict';

///////

var copy_key_code = 221; // ] key
var copy_sound = 'http://heavy.noxiousnet.com/boorucopy.ogg';
var iv2_confidence_rating = 20.0;

///////

var tags_selector = 'h5, b';
var copy_button_style = 'position:fixed;width:100px;right:2px;top:2px;font:11px monospace;font-weight:0;border:1px solid black;background:rgba(0,0,0,0.1);z-index:9999;';

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
            text = replaceAll(text, ' ', '_');

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

function copyBooruTags(tags, noRating)
{
    // Instead of having a list of boorus and their tag structure I just make a big catch-all.

    // danbooru-like
    insertTags(tags, '#tag-list li.category-3 > a.search-tag', 'series:');
    insertTags(tags, '#tag-list li.category-1 > a.search-tag', 'creator:');
    insertTags(tags, '#tag-list li.category-4 > a.search-tag', 'character:');
    insertTags(tags, '#tag-list li.category-0 > a.search-tag', '');

    // lolibooru-like
    insertTags(tags, 'li.tag-type-copyright > a', 'series:');
    insertTags(tags, 'li.tag-type-author > a', 'creator:');
    insertTags(tags, 'li.tag-type-character > a', 'character:');
    insertTags(tags, 'li.tag-type-general > a', '');
    
    // booru.org-like
    insertTags(tags, '#tag_list li a', '');

    if (!noRating)
    {
        // danbooru-like
        insertRating(tags, '#post-information > ul li');
        
        // lolibooru-like
        insertRating(tags, '#stats > ul li');
        
        // booru.org-like
        insertRating(tags, '#tag_list ul');
    }

    /*var elements = document.querySelectorAll(tags_selector);
    for (var i=0; i < elements.length; i++)
    {
        var element = elements[i];
        if (element.innerHTML == 'Tags')
        {
            element.innerHTML = 'Tags (Copied)';
            element.style.color = 'lime';
            break;
        }
    }*/
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

        tag = replaceAll(tag, ' ', '_');

        if (prefix)
            tag = prefix + tag;

        tags[tags.length] = tag;

        if (prefix == 'rating') // only add one rating
            break;
    }
}

function copyI2VTags(tags, confidenceRequired, noGeneral, noRating)
{
    insertI2VTags(tags, 'table#copyright_root tr', 'series:', confidenceRequired);
    insertI2VTags(tags, 'table#character_root tr', 'character:', confidenceRequired);

    if (!noGeneral)
        insertI2VTags(tags, 'table#general_root tr', '', confidenceRequired);

    if (!noRating)
        insertI2VTags(tags, 'table#rating_root tr', 'rating:', confidenceRequired);
}

function doCopyAll()
{
    var tags = [];

    copyBooruTags(tags);
    copyI2VTags(tags, iv2_confidence_rating, false);

    GM_setClipboard(tags.join('\n'));
    
    var buttontext = '';
    
    if (tags.length > 0)
    {
        playCopySound();
        buttontext = 'copied ' +  tags.length +' tag(s)'
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

        // hydrus stuff
        //element.outerHTML = '<div><form enctype="multipart/form-data" action="http://localhost:45866" method="POST">'
        //    + '<input name="file" type="file" />'
        //    + '<input type="submit" value="Send" />'
        //    + '</form></div> '
        //    + element.outerHTML;

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
    if (audio)
        audio.play();
}

var copyButtonArea = document.createElement('button');
copyButtonArea.innerHTML = 'copy tags';
copyButtonArea.id = 'copytagsbutton';
copyButtonArea.setAttribute('style', copy_button_style);
copyButtonArea.onclick = doCopyAll;
document.body.appendChild(copyButtonArea);
