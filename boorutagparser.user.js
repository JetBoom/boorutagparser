// ==UserScript==
// @name         Booru Tag Parser
// @namespace    https://average.website
// @version      1.2.0
// @description  Copy current post tags and rating on boorus and illustration2vec in to the clipboard for easy import in to a program or another booru.
// @author       William Moodhe
// @downloadURL  https://github.com/JetBoom/boorutagparser/raw/master/boorutagparser.user.js
// @updateURL    https://github.com/JetBoom/boorutagparser/raw/master/boorutagparser.user.js

// @match      *://*demo.illustration2vec.net*

// @match      *://*booru*/post*
// @match      *:booru*/*?page=post*
// @match      *://*booru*/?page=post
// @match      *://*booru*/index.php?id=*

// @match      *://danbooru.donmai.us/posts/*
// @match      *://*.rule34.xxx/index.php?page=post*
// @match      *://*.chan.sankakucomplex.com/post/show/*
// @match      *://*.chan.sankakucomplex.com/?tags=*
// @match      *://*.idol.sankakucomplex.com/post/show/*
// @match      *://*.idol.sankakucomplex.com/?tags=*
// @match      *://*.behoimi.org/post/show/*
// @match      *://*.e621.net/posts/*
// @match      *://*.konachan.com/post/*
// @match      *://*.konachan.net/post/*
// @match      *://*.shimmie.katawa-shoujo.com/post/*
// @match      *://*.rule34.paheal.net/post/*
// @match      *://*.rule34hentai.net/post/*
// @match      *://*.tbib.org/index.php?page=post*
// @match      *://*.yande.re/post/*
// @match      *://*.derpibooru.org*
// @match      *://*.derpiboo\.ru/[1-9]+/
// @match      *://*.derpibooru\.org/[1-9]+/
// @match      *://*.trixiebooru\.org/[1-9]+/
// @match      *://*.sofurry.com*
// @match      *://*.twentypercentcooler.net*

// @match      *://*.nhentai.net/g/*

// @run-at       document-end
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest

// ==/UserScript==
/* jshint -W097 */
'use strict'

///////

let copy_key_code = GM_getValue('copy_key_code', 221) // ] key
let download_key_code = GM_getValue('download_key_code', 220) // \ key
let copy_sound = GM_getValue('copy_sound', '')
let iv2_confidence_rating = GM_getValue('iv2_confidence_rating', 20.0)
let attach_explicit = GM_getValue('attach_explicit', true)
let attach_gid = GM_getValue('attach_gid', true)
let div_top = GM_getValue('div_top', false)

// Fix for older versions linking this.
if (copy_sound === 'http://heavy.noxiousnet.com/boorucopy.ogg') {
    copy_sound = ''
}

///////

const tags_selector = 'h5, b'
const button_style = 'font:12px sans-serif;font-weight:0;border:1px solid black;background:#eee;color:#000;display:block;width:90%;margin:2px auto;border-radius:8px;z-index:9999;'
const div_style = 'opacity:0.2;position:fixed;width:300px;right:2px;top:2px;text-align:center;font:12px sans-serif;font-weight:0;border:1px solid black;background:rgba(255,255,255,0.8)z-index:9999;'

// Possible rating meta tags
const possibleRatings = ['rating:explicit', 'rating:questionable', 'rating:safe']

// Selectors to use when searching for the download original file button
const originalFileSelectors = [
    '#image-download-link > a',
    'a[href*="/data/_"]',
    '#post-information > ul > li > a[href*="/__"]',
    'a#highres',
    'a[itemprop="contentSize"]',
    'li > a[href*="/images/"]',
    'section#image-container > a > img',
    'img[src*="/_images/"]',
    'a[href*="/img/download"][title="Download (short filename)"]',
    'a[href*="/img/download"][title="Download (no tags in filename)"]',
    'form[action*="/_images/"]',
    'source[src]',
    'div a#image-link[href*="/data/"]',
    'div video[id="image"]',
]

// Convert these meta tags, for consistency
const metaAliases = {
    'group': 'studio',
    'parody': 'series',
    'artist': 'creator',
}

function replaceAll(str, originalstr, newstr) {
    return str.split(originalstr).join(newstr)
}

function insertTags(tags, selector, prefix = '', stripns = false) {
    for (const element of document.querySelectorAll(selector))
    {
        let text = element.innerHTML
        if (text === '-' || text === '+' || text === '?') continue

        text = replaceAll(text, '_', ' ')
        text = replaceAll(text, '&gt;', '>')
        text = replaceAll(text, '&lt;', '<')

        if (stripns) {
            text = text.match(".*?:(.*)")[1]
        }

        text = prefix + text

        tags.push(text)
    }
}

function trimTag(tag) {
    return replaceAll(tag.toLowerCase().trim(), ' ', '')
}

function insertRating(tags, selector) {
    for (const element of document.querySelectorAll(selector))
    {
        const text = trimTag(element.innerHTML)

        possibleRatings.forEach(rating => {
            if (text.includes(rating)) {
                tags.push(rating)
            }
        })
    }
}

async function copyNHentaiTags(noRating, callback) {
    // nhentai has a json output we can use.
    // Which is nice because the tags are available even if viewing an individual file.

    let id = window.location.href.match('/g/(\\d+)/*')[1]
    if (!id) return

    id = Number(id)

    try {
        const response = await fetch(`https://nhentai.net/g/${id}/json`)
        const json = await response.json()

        const tags = []
    
        if (json.tags)
        {
            for (const t of json.tags)
            {
                let [ , tagtype, tag] = t

                // maintain schema consistency
                tagtype = metaAliases[tagtype] ?? tagtype
                
                if (tagtype !== 'tag') {
                    tag = `${tagtype}:${tag}`
                }

                tags.push(tag)
            }
        }

        if (attach_explicit) {
            tags.push('rating:explicit')
        }

        if (attach_gid && json.id) {
            tags.push('gallery:' + json.id)
        }

        copyTagsToClipboard(tags)

        if (callback) {
            callback(tags)
        }

        return tags
    } catch (e) {
        console.error('Could not fetch json!')
    }
}

function copyBooruTags(noRating)
{
    const tags = []
    
    // danbooru-like-new
    insertTags(tags, '#tag-list li.tag-type-3 a.search-tag', 'series:')
    insertTags(tags, '#tag-list li.tag-type-1 a.search-tag', 'creator:')
    insertTags(tags, '#tag-list li.tag-type-4 a.search-tag', 'character:')
    insertTags(tags, '#tag-list li.tag-type-5 a.search-tag', 'meta:')
    insertTags(tags, '#tag-list li.tag-type-0 a.search-tag', '')

    // danbooru-like-old
    insertTags(tags, '#tag-list li.category-3 > a.search-tag', 'series:')
    insertTags(tags, '#tag-list li.category-1 > a.search-tag', 'creator:')
    insertTags(tags, '#tag-list li.category-4 > a.search-tag', 'character:')
    insertTags(tags, '#tag-list li.category-0 > a.search-tag', '')

    // lolibooru-like
    insertTags(tags, 'li.tag-type-copyright > a', 'series:')
    insertTags(tags, 'li.tag-type-author > a', 'creator:')
    insertTags(tags, 'li.tag-type-artist > a', 'creator:')
    insertTags(tags, 'li.tag-type-character > a', 'character:')
    insertTags(tags, 'li.tag-type-model > a', 'model:')
    insertTags(tags, 'li.tag-type-idol > a', 'model:')
    insertTags(tags, 'li.tag-type-general > a', '')
    insertTags(tags, 'li.tag-type-studio > a', 'studio:')
    insertTags(tags, 'li.tag-type-circle > a', 'studio:')
    insertTags(tags, 'li.tag-type-medium > a', 'medium:')
    insertTags(tags, 'li.tag-type-style > a', 'medium:')
    insertTags(tags, 'li.tag-type-meta > a', 'meta:')
    insertTags(tags, 'li.tag-type-species > a', 'species:')
    insertTags(tags, 'li.tag-type-faults > a', 'fault:')
    insertTags(tags, 'li.tag-type-genre > a', 'genre:')

    // derpibooru-like
    insertTags(tags, '.tag-list [data-tag-category="origin"]:not([data-tag-name="edit"]):not([data-tag-slug="derpibooru+exclusive"]):not([data-tag-slug="edited+screencap"]):not([data-tag-slug="screencap"]):not([data-tag-slug="anonymous+artist"]):not([data-tag-slug="alternate+version"]):not([data-tag-slug="color+edit"]):not([data-tag-slug="them%27s+fightin%27+herds"]) > span > a', 'creator:', true) //Fixes a problem where the tag parser script would fail to work on pages with these tags, or multiple of these tags.
    insertTags(tags, '.tag-list .tag.tag-ns-oc > span > a', 'character:', true)
    insertTags(tags, '.tag-list .tag.tag-system > span > a', 'rating:')
    insertTags(tags, '.tag-list [class="tag dropdown"]:not([data-tag-category="character"]):not([data-tag-category="origin"]):not([data-tag-category="spoiler"]):not([data-tag-category="episode"]) > span > a', '') // generic tags on derpibooru do not have a "namespace" class of their own, this seems to be the best way to match generic tags
    insertTags(tags, '.tag-list [data-tag-category="character"] > span > a', 'character:') // grabs the new character tags on Derpibooru and gives them a proper character namespace for Hydrus
    insertTags(tags, '.tag-list [data-tag-category="episode"] > span > a', 'episode:') // grabs the show episode title and gives it an episode namespace for Hydrus
    insertTags(tags, '[data-tag-name="edit"] > span > a', '') //Since derpibooru has edits tagged as an artist, this converts that to a general edit tag
    insertTags(tags, '[data-tag-slug="derpibooru+exclusive"] > span > a', '') //Since derpibooru has derpi exclusives tagged as an artist, this converts that to a general tag
    insertTags(tags, '[data-tag-slug="edited+screencap"] > span > a', '') //makes the edited screencap into a general tag
    insertTags(tags, '[data-tag-slug="screencap"] > span > a', '') //Makes the screencap tag into a general tag
    insertTags(tags, '[data-tag-slug="anonymous+artist"] > span > a', '') //Makes Anon Artist into a general tag which Hydrus will then convert into a creator tag via tag siblings
    insertTags(tags, '[data-tag-slug="alternate+version"] > span > a', '') //Since derpibooru has alternate versions tagged as an artist, this converts that to a general tag
    insertTags(tags, '[data-tag-slug="color+edit"] > span > a', '') //Since derpibooru has color edits tagged as an artist, this converts that to a general tag
    insertTags(tags, '[data-tag-slug="them%27s+fightin%27+herds"] > span > a', 'series:') //Adds them's fightin' herds as a series tag

    // sofurry like
    insertTags(tags, '.titlehover > a', '')
    
    // booru.org-like
    insertTags(tags, '#tag_list li a', '')

    // paheal-like
    insertTags(tags, 'a.tag_name', '')
    
    if (!noRating)
    {
        // danbooru-like
        insertRating(tags, '#post-information > ul li')

        // lolibooru-like
        insertRating(tags, '#stats > ul li')

        // booru.org-like
        insertRating(tags, '#tag_list ul')
    }

    copyTagsToClipboard(tags)

    return tags
}

function insertI2VTags(tags, selector, prefix, confidenceRequired)
{
    for (const element of document.querySelectorAll(selector))
    {
        if (confidenceRequired > 0)
        {
            let confidence = element.children[3].children[0].innerHTML
            confidence = confidence.substr(0, confidence.length - 1)
            confidence = Number(confidence)

            if (confidence < confidenceRequired) continue
        }

        let tag = element.children[1].innerHTML

        tag = replaceAll(tag, '_', ' ')

        if (prefix) {
            tag = prefix + tag
        }

        tags.push(tag)

        if (prefix == 'rating') break // only add one rating
    }
}

function copyI2VTags(confidenceRequired, noGeneral, noRating)
{
    const tags = []

    insertI2VTags(tags, 'table#copyright_root tr', 'series:', confidenceRequired)
    insertI2VTags(tags, 'table#character_root tr', 'character:', confidenceRequired)

    if (!noGeneral)
        insertI2VTags(tags, 'table#general_root tr', '', confidenceRequired)

    if (!noRating)
        insertI2VTags(tags, 'table#rating_root tr', 'rating:', confidenceRequired)

    copyTagsToClipboard(tags)

    return tags
}

function doCopyAll(callback)
{
    control.style.opacity = '1'

    let resultingTags

    if (window.location.href.includes('nhentai.net')) {
        resultingTags = copyNHentaiTags(null, callback)
    } else if (window.location.href.includes('illustration2vec.net')) {
        resultingTags = copyI2VTags(iv2_confidence_rating, false)
    } else {
        resultingTags = copyBooruTags()
    }

    if (callback) {
        callback(resultingTags)
    }
}

function copyTagsToClipboard(tags)
{
    GM_setClipboard(tags.join('\n'))

    let buttontext

    if (tags.length > 0) {
        playCopySound()
        buttontext = `copied ${tags.length} tag(s)`
    } else {
        buttontext = 'nothing to copy!'
    }

    const button = document.querySelector('button#copytagsbutton')
    if (button) {
        button.innerHTML = buttontext
        setTimeout(() => button.innerHTML = 'copy tags', 3000)
    }
}

function doOptions() {
    optionsArea.style.display = optionsArea.style.display === 'none' ? 'block' : 'none'
}

function toBase64(arrayBuffer) {
    return btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
}

function makeDownloadRequest(href, tags) {
    tags = tags ?? []

    GM_xmlhttpRequest({
        method: 'GET',
        url: href,
        responseType: 'arraybuffer',
        onload: (response) => {
            console.log('Downloaded')

            const base64 = toBase64(response.response)

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'http://localhost:14007/import',
                data: JSON.stringify({
                    tags,
                    url: href,
                    fileData: base64,
                }),
                anonymous: true,
                timeout: 30000,
                onload: (response) => {
                    console.log(response)
                },
                onerror: (err) => {
                    console.error(err)
                    alert('Error downloading to your local server. Is boorutagparser-server running?\nGet it at github.com/JetBoom/boorutagparser-server if you do not have it.')
                }
            })
        }
    })
}

function doDownload() {
    const downloadLink = document.querySelector('a.original-file-unchanged') || document.querySelector(originalFileSelectors.join(', '))
    if (!downloadLink) return

    const href = downloadLink.src ?? downloadLink.href

    doCopyAll(tags => makeDownloadRequest(href, tags))
}

function doc_keyUp(e) {
    if (e.keyCode == copy_key_code) {
        doCopyAll()
    } else if (e.keyCode == download_key_code) {
        doDownload()
    }
}
document.addEventListener('keyup', doc_keyUp, false)

var elements = document.querySelectorAll(tags_selector)
for (var i=0; i < elements.length; i++) {
    const element = elements[i]
    if (element.innerHTML == 'Tags') {
        element.onclick = copyBooruTags
        break
    }
}

let audio

if (copy_sound.length > 0) {
    audio = document.createElement("audio")
    audio.src = copy_sound
    audio.preload = false
}

function playCopySound() {
    if (audio && copy_sound.length > 0) {
        audio.play()
    }
}

function doChangeConfidence(e) {
    iv2_confidence_rating = Number(optionForConfidence.value)
    captionForConfidence.innerHTML = 'iv2 min confidence: ' + iv2_confidence_rating + '%'
    GM_setValue('iv2_confidence_rating', iv2_confidence_rating)
}

function doChangeCopySound(e) {
    copy_sound = String(optionForCopySound.value)
    GM_setValue('copy_sound', copy_sound)

    if (audio) {
        audio.src = copy_sound
    }
}

function doChangeAttachExplicit(e) {
    attach_explicit = optionForAttachExplicit.checked
    GM_setValue('attach_explicit', attach_explicit)
}

function doChangeAttachGID(e) {
    attach_gid = optionForAttachGID.checked
    GM_setValue('attach_gid', attach_gid)
}

function doChangeDivTop(e) {
    div_top = optionForDivTop.checked
    GM_setValue('div_top', div_top)

    if (div_top) {
        control.style.top = '2px'
        control.style.bottom = ''
    }
    else {
        control.style.top = ''
        control.style.bottom = '2px'
    }
}

var control = document.createElement('div')
control.id = 'boorutagparser'
control.setAttribute('style', div_style)
control.onmouseenter = function(e) { this.style.opacity = 1 }
control.onmouseleave = function(e) { this.style.opacity = 0.2 }
document.body.appendChild(control)

var copyButton = document.createElement('button')
copyButton.innerHTML = 'copy tags'
copyButton.id = 'copytagsbutton'
copyButton.setAttribute('style', button_style)
copyButton.onclick = () => void doCopyAll()
control.appendChild(copyButton)

var optionsButton = document.createElement('button')
optionsButton.innerHTML = 'options'
optionsButton.id = 'optionsbutton'
optionsButton.setAttribute('style', button_style)
optionsButton.onclick = doOptions
control.appendChild(optionsButton)

var downloadButton = document.createElement('button')
downloadButton.innerHTML = 'download with tags'
downloadButton.id = 'downloadbutton'
downloadButton.setAttribute('style', button_style)
downloadButton.onclick = doDownload
control.appendChild(downloadButton)

var optionsArea = document.createElement('div')
optionsArea.id = 'optionsarea'
optionsArea.setAttribute('style', 'display:none;')
control.appendChild(optionsArea)

if (window.location.href.includes('illustration2vec.net')) {
    var captionForConfidence = document.createElement('span')
    captionForConfidence.id = 'captionconfidence'
    captionForConfidence.innerHTML = 'iv2 min confidence: ' + iv2_confidence_rating + '%'
    optionsArea.appendChild(captionForConfidence)

    var optionForConfidence = document.createElement('input')
    optionForConfidence.id = 'optionsconfidence'
    optionForConfidence.setAttribute('type', 'range')
    optionForConfidence.setAttribute('value', iv2_confidence_rating)
    optionForConfidence.setAttribute('min', 0)
    optionForConfidence.setAttribute('max', 100)
    optionForConfidence.onchange = doChangeConfidence
    optionsArea.appendChild(optionForConfidence)
}

if (window.location.href.includes('nhentai.net/g/')) {
    var optionForAttachExplicit = document.createElement('input')
    optionForAttachExplicit.setAttribute('type', 'checkbox')
    optionForAttachExplicit.checked = attach_explicit
    optionForAttachExplicit.onchange = doChangeAttachExplicit
    optionsArea.appendChild(optionForAttachExplicit)

    var captionForAttachExplicit = document.createElement('span')
    captionForAttachExplicit.innerHTML = 'add rating:explicit<br>'
    optionsArea.appendChild(captionForAttachExplicit)

    var optionForAttachGID = document.createElement('input')
    optionForAttachGID.setAttribute('type', 'checkbox')
    optionForAttachGID.checked = attach_gid
    optionForAttachGID.onchange = doChangeAttachGID
    optionsArea.appendChild(optionForAttachGID)

    var captionForAttachGID = document.createElement('span')
    captionForAttachGID.innerHTML = 'add gallery:id#<br>'
    optionsArea.appendChild(captionForAttachGID)
}

var captionForCopySound = document.createElement('span')
captionForCopySound.id = 'captioncopysound'
captionForCopySound.innerHTML = 'copy sound url'
optionsArea.appendChild(captionForCopySound)

var optionForCopySound = document.createElement('input')
optionForCopySound.id = 'optionssound'
optionForCopySound.setAttribute('value', copy_sound)
optionForCopySound.setAttribute('style', 'display:block;font-size:10px;width:90%;margin:1px auto;')
optionForCopySound.onchange = doChangeCopySound
optionsArea.appendChild(optionForCopySound)

var optionForDivTop = document.createElement('input')
optionForDivTop.setAttribute('type', 'checkbox')
optionForDivTop.checked = div_top
optionForDivTop.onchange = doChangeDivTop
optionsArea.appendChild(optionForDivTop)

var captionForDivTop = document.createElement('span')
captionForDivTop.innerHTML = 'attach to top of page<br>'
optionsArea.appendChild(captionForDivTop)

var version = document.createElement('div')
version.innerHTML = GM_info.script.version
version.setAttribute('style', 'font-size:8px;')
optionsArea.appendChild(version)

doChangeDivTop()
