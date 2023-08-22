
initLightSwitch('css_light', 'btn_light')
window.scrollTo(0, 0)
const log = console.log
console.clear()
log({buildId})
const version = 'v1.0'
setInterval(() => document.title = "JLC's MJ Archiver "+version, 500)
log("Welcome to JLC's Midjourney Archiver "+version+"! 🙋")
log("Some MJ scripts may still throw errors btw, so the errors displayed in this log isn't necessarily from this archiver. Any errors from a script ending with .js is not ours, e.g. main-2d290b7240a6d3c3.js:1. The MJ scripts are just confused because whe changed the contents of the HTML. 🤪")

// just testing something here
window.addEventListener('error', ({error}) => {
  console.error('An uncaught error occurred:', error)
  if (error.message.includes('network')) {
    updateStatus('An uncaught network error occurred; in case it caused the archiver to stop the "start" button has been re-activated.')
    ui.btn_start.disabled = false
    // this is a Chromium bug where `await fetch()` network errors are not caught in a try/catch block
  } else {
    throw error
  }
})

const defaultConfig = {
  cdn: ['https://cdn.midjourney.com/', 'https://storage.googleapis.com/dream-machines-output/'],
  downloadExt: '.webp',
  toArchive: {
    v5gridsAsUpscaled: true,
    lowResGrids: false,
    unLiked: true,
    allowedRanking: [null, 1, 2, 4, 5], // 1 hated, 2 disliked, 4 liked, 5 loved
  },
  dryRun: false,
  cacheExtraJobDetails: true,
  skipLoggingEachImage: true,
  testRun: false,
  maxConcurrency: 10,
}
let archive, config
let totalJobCount, jobsProcessed, imgsDownloaded
let archiverRunning, abortArchiver

const ui = {}
for (const id of ['chk_v5grids', 'chk_lrGrids', 'chk_unliked', 'chk_rNone', 'chk_rHate', 'chk_rDislike', 'chk_rLike', 'chk_rLove', 'chk_dryRun', 'chk_jobDetailsFromCache', 'chk_skipLoggingDownloads', 'chk_testRun', 'val_maxConcurrency', 'status', 'progress', 'cfg1', 'cfg2', 'btn_folder', 'btn_start', 'btn_stop']) {
  ui[id] = document.getElementById(id)
}
ui.cfg1.style.display = 'none'
ui.cfg2.style.display = 'none'
ui.btn_folder.addEventListener('click', changeArchiveFolder)
ui.btn_start.addEventListener('click', start)
ui.btn_stop.addEventListener('click', stop)
updateStatus('Please select where to store the archive...')

function validateConfig() {
  if (typeof config != 'object') throw 'Config is not an object, value of config: '+config
  for (const key of ['cdn', 'downloadExt', 'toArchive', 'dryRun', 'cacheExtraJobDetails', 'skipLoggingEachImage', 'testRun', 'maxConcurrency']) {
    if (!(key in config)) throw 'Missing key in config: '+key
  }
  for (const key of ['v5gridsAsUpscaled', 'lowResGrids', 'unLiked', 'allowedRanking']) {
    if (!(key in config.toArchive)) throw 'Missing key in config.toArchive: '+key
  }
  if (!Array.isArray(config.cdn) || config.cdn.length < 1) throw 'Invalid cdn array'
  if (!['.webp','.png'].includes(config.downloadExt)) throw 'Invalid downloadExt'
  if (!Array.isArray(config.toArchive.allowedRanking)) throw 'allowedRanking not an array'
  for (const rank of config.toArchive.allowedRanking) {
    if (![null, 1, 2, 4, 5].includes(rank)) throw 'Invalid rank: '+rank
  }
  if (config.maxConcurrency < 1 || config.maxConcurrency > 10) throw `A maxConcurrency of ${config.maxConcurrency} is not allowed!`
}

async function changeArchiveFolder() {
  ui.progress.style.width = '0%'
  // reset ui in case of error
  ui.btn_start.disabled = true
  ui.cfg1.style.display = 'none'
  ui.cfg2.style.display = 'none'
  // ui.btn_stop.disabled = true
  archive = null
  let newArchive
  try {
    newArchive = new DirectoryHandler(await window.showDirectoryPicker({startIn: 'downloads'}))
    config = await newArchive.readFile('config.json', {asJSON: true, nullOnError: true})
    const newConfig = (config == null)
    if (newConfig) {
      config = defaultConfig
    } else { // then check that it's okay
      try {
        validateConfig()
      } catch (error) {
        updateStatus('Invalid config file found; reverted back to the default! Error was: '+error)
      }
    }
    mirrorConfigToUi()
    // below happens only if no throws
    ui.cfg1.style.display = 'block'
    ui.cfg2.style.display = 'block'
    ui.btn_start.disabled = false
    archive = newArchive
    updateStatus(newConfig ?
      'Creating a new archive, waiting to start...' :
      'Resuming previous archive, waiting to start...'
    )
  } catch (error) {
    if (error.name == 'AbortError') {
      updateStatus('No archive selected...')
    } else {
      updateStatus(error)
      throw error
    }
  }
}

async function start() {
  if (archiverRunning) {
    abortArchiver = true
    updateStatus('Restarting after error...')
    await new Promise(resolve => setTimeout(resolve, 4000))
  }
  archiverRunning = true
  abortArchiver = false

  ui.cfg1.disabled = true
  ui.cfg2.disabled = true
  ui.btn_folder.disabled = true
  ui.btn_start.disabled = true
  ui.btn_stop.disabled = false
  ui.progress.style.width = '0%'

  try {
    validateConfig() // should never fail here though
    await mirrorUiToConfig()
  
    archive.dirHandleCaching = false // clears it
    archive.dirHandleCaching = true
  
    if (!await archive.hasFile('database/imgs/readme.txt')) {
      await archive.writeFile('database/imgs/readme.txt', `The files in this directory are records for keeping track of which images are downloaded. Meaning you can rename and / or move the downloaded images without affecting this knowledge.`, {earlyExit: true})
    }
    if (!await archive.hasFile('database/jobs/readme.txt')) {
      await archive.writeFile('database/jobs/readme.txt', `The files in this directory contains additional information about a job related to an image, e.g. the full command used.`, {earlyExit: true})
    } 
    if (!await archive.hasFile('images/readme.txt')) {
      await archive.writeFile('images/readme.txt', `This is where your images are archived. You can freely move or rename these images without causing a re-download. Every image name starts with the job ID that created it (before the first dot); hence you can look this ID up in "database/jobs" to find out more details about the job.`, {earlyExit: true})
    }
    
    updateStatus('Running...')
    await runArchivingJob()
    updateStatus(abortArchiver ? 'Aborted!' : 'Completed.')
  } catch (error) {
    updateStatus(error)
    abortArchiver = true
  } finally {
    archiverRunning = false
    ui.cfg1.disabled = false
    ui.cfg2.disabled = false
    ui.btn_folder.disabled = false
    ui.btn_start.disabled = false
    ui.btn_stop.disabled = true
  }
}

function stop() {
  abortArchiver = true
  ui.btn_stop.disabled = true
}

async function runArchivingJob() {
  jobsProcessed = 0, imgsDownloaded = 0
  let totalImgsOfInterest = 0
  const {pageProps: {days: daysWithJobs}} = await fetchJson('https://www.midjourney.com/_next/data/'+buildId+'/app/archive.json')
  totalJobCount = daysWithJobs.reduce((sum, {jobs}) => sum + jobs, 0)
  log(`Total job count: ${totalJobCount} (a higher number than what's shown by Midjourney btw)`); log('')
  // (we use reverse() to get the chronological order)
  for (const {d: day, m: month, y: year, jobs: numJobs} of daysWithJobs.reverse()) {
    if (abortArchiver) {
      console.groupEnd()
      console.warn('Archiver aborted (stop button pressed)!')
      break
    }
    await archive.waitPendingCloses() // wait for any writeFile earlyExit closes to be done (chromium issue 1472581 mitigation)
    console.group(`Processing ${numJobs} jobs for day ${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}:`)
    const jobsFromDay = new Map((await getJobsFromDay(numJobs, {year, month, day})).reverse().map(v => [v.id, v])) // (minimal amount of job detail)
    const interestingJobs = new Map()
    for (const job of jobsFromDay.values()) {
      if (isInterestingJob(job)) interestingJobs.set(job.id, job)
    }
    let imgsToDownload = []
    if (interestingJobs.size) {
      log(`Found ${interestingJobs.size} interesting jobs, fetching more details about them...`)
      await fetchExtraJobDetails(interestingJobs, {year, month, day}) // download more details
      if (abortArchiver) {console.groupEnd(); continue}
      // which allows us to check like and rating status (from owner)
      let filteredAway = 0, imgsOfInterest = 0, imgsAlreadyArchived = 0
      const archivedJobIds = config.cacheExtraJobDetails ? null : await filesInDir(`database/jobs/${year}/${month}/${day}`, '.json')
      const archivedImageIds = await filesInDir(`database/imgs/${year}/${month}/${day}`, '.record')
      for (const job of interestingJobs.values()) {
        if (filterByLikeAndRank(job)) {
          interestingJobs.delete(job.id) // not interesting then
          filteredAway ++
          continue
        }
        if (!config.cacheExtraJobDetails && !archivedJobIds.has(job.id)) { // skip if already archived
          await archiveJob(job, true)
        }
        for (const imgId of extractImageIds(job)) {
          imgsOfInterest ++
          if (archivedImageIds.has(imgId)) {
            imgsAlreadyArchived ++
          } else {
            imgsToDownload.push({imgId, job})
          }
        }
      }
      if (filteredAway) log(`The like & rating filter filtered away ${filteredAway} of those jobs.`)
      if (imgsOfInterest) {
        totalImgsOfInterest += imgsOfInterest
        log(`We found ${imgsOfInterest} images we're interested in.`)
        if (imgsAlreadyArchived) log(`And ${imgsAlreadyArchived == imgsOfInterest ? 'all' : imgsAlreadyArchived} of them are already archived.`)
      } else {
        log('We didn\'t find any images we\'re interested in...')
      }
      if (config.dryRun) {
        log('But this was a "dry run", hence no image archiving took place!')
      } else {
        if (imgsToDownload.length) {
          if (!config.skipLoggingEachImage) log('')
          log(`Archiving ${imgsToDownload.length} images with up to ${config.maxConcurrency} concurrent downloads`+(config.skipLoggingEachImage ? '.' : ':'))
          const cc_imgDownloads = new ConcurrencyController(config.maxConcurrency)
          for (const {imgId, job} of imgsToDownload) {
            if (!archivedImageIds.has(imgId)) {
              cc_imgDownloads.pushJob(archiveImage, imgId, job)
            }
          }
          await cc_imgDownloads.donePromise // wait for downloads to complete
          if (!config.skipLoggingEachImage) log('')
        }
      }
    } else {
      log(`Found no jobs of interest to us.`)
    }
    console.groupEnd()
    if (!abortArchiver) {
      log('Done with that day! 😎'); log('')
      jobsProcessed += numJobs
      ui.progress.style.width = Math.trunc((jobsProcessed / totalJobCount) * 100)+'%'
    }
    if (config.testRun) break
  }
  if (!abortArchiver) log('Oh, it seems we\'re all done! 😊 Congratulations! 🎆 And thank you for using my software! 👍')
  log(`Total images of interest found was ${totalImgsOfInterest}, and images that were downloaded (not previously archived) was ${imgsDownloaded}.`)
  if (config.testRun) log('This was a test run, hence we only processed the first day of your Midjourney adventure. Please check if everything looks correct! 🙂')
  if (config.dryRun) log('This was a "dry run" though, hence no downloading took place!')
}

async function archiveImage(imgId, job, {maxRetries = 3, retryDelay = 2000} = {}) {
  if (abortArchiver) return
  const {year, month, day} = yearMonthDay(job.enqueue_time)
  const url = config.cdn[imgsDownloaded++ % config.cdn.length] + imgId.replace('.','/') + config.downloadExt
  if (!config.skipLoggingEachImage) console.time('Archiving: '+url)
  const filePath = `images/${year}/${month}/${day}/`
  const fileName = imgId+'.'+titleFromTextPrompt(job.textPrompt)+config.downloadExt
  let response, numRetries = 0
  do {
    try {
      response = await fetch(url)
    } catch (error) { // e.g. TypeError: network error
      response = {ok: false, status: error}
    }
    if (!response.ok) {
      if (numRetries++ < maxRetries) {
        console.warn(`HTTP error ${response.status} while downloading image. Trying again after a short delay...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      } else {
        console.error(`HTTP error ${response.status} while downloading image. Giving up, try again later (the database will remember which).`)
        break
      }
    }
  } while (!response.ok)
  if (response.ok) {
    try {
      const writable = await archive.getWritableStream(filePath+fileName)
      await response.body.pipeTo(writable) // closes the destination pipe by default
      // if success (no throws) then write the record
      await archive.writeFile(`database/imgs/${year}/${month}/${day}/${imgId}.record`, '', {earlyExit: true})
    } catch (error) {
      console.error(error)
    } finally {
      if (!config.skipLoggingEachImage) console.timeEnd('Archiving: '+url)
    }
  }
  updateStatus()
}

/** From a minimal job description from `getJobsFromDay()` check if it is interesting to us or not. */
function isInterestingJob({id, type, parent_id, parent_grid}) {
  if (parent_id && parent_grid == null) console.warn('Parent_id but no parent_grid.')
  const v5      = type.includes('v5')
  const grid    = type.includes('diffusion')
  const upscale = type.includes('upscale') || type.includes('upsample')
  if (grid) {
    if (v5) {if (config.toArchive.v5gridsAsUpscaled) return true} // then we can ignore v5 virtual upscale jobs
    else    {if (config.toArchive.lowResGrids)       return true}
  } else {
    if (!upscale) console.warn('Not diffusion but not upscale/upsample, type: '+type)
    if (!(v5 && config.toArchive.v5gridsAsUpscaled)) return true // skips v5 virtual upscale jobs if wanted
  }
  return false
}

function filterByLikeAndRank(job) {
  const {liked_by_user, ranking_by_user} = job
  if (!config.toArchive.unLiked && !liked_by_user) return true
  if (!config.toArchive.allowedRanking.includes(ranking_by_user)) return true
  return false
}

function updateStatus(text) {
  if (text) {
    log(''); log('Status update:', text)
    ui.status.textContent = text
    return
  }
  ui.status.textContent = `${jobsProcessed} of ${totalJobCount} jobs processed and ${imgsDownloaded} images downloaded. 😎`
}

function mirrorConfigToUi() {
  if (config.toArchive.v5gridsAsUpscaled) ui.chk_v5grids.checked = true
  if (config.toArchive.lowResGrids) ui.chk_lrGrids.checked = true
  if (config.toArchive.unLiked) ui.chk_unliked.checked = true
  for (const rank of config.toArchive.allowedRanking) {
    let id
    switch (rank) {
      default: throw Error('No such rank: '+rank)
      case null: id = 'chk_rNone'; break
      case 1: id = 'chk_rHate'; break
      case 2: id = 'chk_rDislike'; break
      case 4: id = 'chk_rLike'; break
      case 5: id = 'chk_rLove'; break
    }
    ui[id].checked = true
  }
  if (config.dryRun) ui.chk_dryRun.checked = true
  if (config.testRun) ui.chk_testRun.checked = true
  if (config.cacheExtraJobDetails) ui.chk_jobDetailsFromCache.checked = true
  if (config.skipLoggingEachImage) ui.chk_skipLoggingDownloads.checked = true
  ui.val_maxConcurrency.value = config.maxConcurrency
}

async function mirrorUiToConfig() {
  config.toArchive.v5gridsAsUpscaled = ui.chk_v5grids.checked
  config.toArchive.lowResGrids = ui.chk_lrGrids.checked
  config.toArchive.unLiked = ui.chk_unliked.checked
  config.toArchive.allowedRanking = []
  for (const rank of [null, 1, 2, 4, 5]) {
    let id
    switch (rank) {
      case null: id = 'chk_rNone'; break
      case 1: id = 'chk_rHate'; break
      case 2: id = 'chk_rDislike'; break
      case 4: id = 'chk_rLike'; break
      case 5: id = 'chk_rLove'; break
    }
    if (ui[id].checked) config.toArchive.allowedRanking.push(rank)
  }
  if (!config.toArchive.allowedRanking.length) {
    throw Error(`Your "images with rating" settings doesn't really allow any image to be archived...`)
  }
  config.dryRun = ui.chk_dryRun.checked
  config.testRun = ui.chk_testRun.checked
  config.cacheExtraJobDetails = ui.chk_jobDetailsFromCache.checked
  config.skipLoggingEachImage = ui.chk_skipLoggingDownloads.checked
  config.maxConcurrency = +ui.val_maxConcurrency.value

  await archive.writeFile('config.json', JSON.stringify(config, null, 2), {earlyExit: true})
}

function titleFromTextPrompt(textPrompt = []) {
  // In the prompt :: splits it into multiple array elements. While the normal comma is passed through.
  // We replace dot and comma with _ and :: with __ and then spaces with -.
  const maxLength = 180
  let title = textPrompt.join('__')
    .replaceAll(', ','_')
    .replaceAll(',','_')
    .replaceAll('.','_')
    .replaceAll('. ','_')
    .replaceAll(' ','-')
    .replace(/[^a-z-_0-9]/gi, '')
  let didTrim
  if (title.length > maxLength) {
    title = title.slice(0, maxLength)
    didTrim = true
  }
  if (title.endsWith('_') || title.endsWith('-')) {
    title = title.slice(0, -1)
  }
  if (didTrim) title += '…'
  return title
}

function archiveJob(job, earlyExit) {
  const data = JSON.stringify(job)
  const {year, month, day} = yearMonthDay(job.enqueue_time)
  return archive.writeFile(`database/jobs/${year}/${month}/${day}/${job.id}.json`, data, {earlyExit})
}

function yearMonthDay(enqueue_time) {
  const [year,month,day] = enqueue_time.split(' ')[0].split('-').map(v => +v)
  return {year,month,day}
}

async function filesInDir(dir, ext, {asSet = true, withoutExt = true} = {}) {
  const files = asSet ? new Set() : []
  for await (const entry of (await archive.getDirectoryHandle(dir, true)).values()) {
    const {kind, name} = entry
    if (kind == 'file' && (!ext || (ext && name.endsWith(ext)))) {
      if (!withoutExt) {
        asSet ? files.add(name) : files.push(name)
      } else {
        asSet ? files.add(name.slice(0,-ext.length)) : files.push(name.slice(0,-ext.length))
      }
    }
  }
  return files
}

/** Extract job image IDs. */
function extractImageIds(job) {
  const imgIds = []
  for (const url of job.image_paths) {
    imgIds.push(url.slice(-44, -8)+'.'+url.slice(-7, -4)) // e.g. 4b97220d-b4b9-430f-9259-7af63b004619.0_3
  } // (just replace the . with / for URL use)
  return imgIds
}

async function fetchExtraJobDetails(jobMap, {year, month, day}) {
  const path = `database/jobs/${year}/${month}/${day}/`
  let jobIds
  if (config.cacheExtraJobDetails) {
    jobIds = new Set([...jobMap.keys()])
    const archivedJobIds = await filesInDir(path, '.json')
    for (const jobId of jobIds) {
      if (archivedJobIds.has(jobId)) {
        try {          
          const fileHandle = await archive.getFile(path+jobId+'.json')
          const job = JSON.parse(await fileHandle.text())
          jobMap.set(job.id, job)
          jobIds.delete(job.id) // then do not download it
        } catch (error) {
          console.warn('fetchExtraJobDetails cache problem: '+error)
        }
      }
    }
    jobIds = [...jobIds.values()] // to download any missing
  } else {
    jobIds = [...jobMap.keys()]
  }
  // batch fetch (50 at a time) any needed job details
  for (let i=0; i<jobIds.length; i+=50) {
    if (abortArchiver) return
    const jobs = await getJobStatus(jobIds.slice(i, i+50))
    for (let job of jobs) {
      job = onlyNeededJobDetails(job)
      jobMap.set(job.id, job)
      if (config.cacheExtraJobDetails) {
        await archive.writeFile(path+job.id+'.json', JSON.stringify(job), {earlyExit: true})
      }
    }
  }
}

/** Extracts only the details we care about from the job. */
function onlyNeededJobDetails(job) {
  const {
    id, type, // e.g. grid
    _job_type,
    liked_by_user, ranking_by_user,
    parent_id, parent_grid,
    event: {eventType, textPrompt, batchSize},
    image_paths,//image_paths.length should match batchSize I think
    enqueue_time, full_command, // even if from parent
  } = job
  return {id, type, _job_type, batchSize, image_paths, liked_by_user, ranking_by_user, parent_id, parent_grid, eventType, textPrompt, enqueue_time, full_command}
}

// verified to work with 50
async function getJobStatus(jobIds) {
  if (!Array.isArray(jobIds)) throw Error('jobIds not an array.')
  const jobStatus = await fetchJson('https://www.midjourney.com/api/app/job-status/', {data: {jobIds}})
  const result = Array.isArray(jobStatus) ? jobStatus : [jobStatus]
  if (result.length != jobIds.length) throw Error('result.length != jobIds.length')
  return result
}

/** Get a list of jobs from the specified day (will be cached in the database). */
async function getJobsFromDay(numJobs, {year, month, day}) {
  let jobsFromDay
  const path = `database/jobs/${year}/${month}/${day}/jobsFromDay.json`
  const fileHandle = await archive.getFile(path, true)
  if (fileHandle) {
    jobsFromDay = JSON.parse(await fileHandle.text())
    if (jobsFromDay.length == numJobs) return jobsFromDay
  }
  jobsFromDay = await fetchJson('https://www.midjourney.com/api/app/archive/day/', {query: {
    year, month, day, includePrompts: true // else just job ID
  }})
  if (jobsFromDay.length != numJobs) throw Error('jobsFromDay.length != numJobs')
  await archive.writeFile(path, JSON.stringify(jobsFromDay), {earlyExit: true})
  return jobsFromDay
}

async function fetchJson(url, {query, data, maxRetries = 3, retryDelay = 2000} = {}) {
  const url_ = new URL(url)
  const options = {}
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url_.searchParams.set(key, value)
    }
  }
  if (data) {
    options.method = 'POST'
    options.headers = {'Content-Type': 'application/json'}
    options.body = JSON.stringify(data)
  }
  let response, numRetries = 0
  do {
    try {
      response = await fetch(url_, options)
    } catch (error) { // e.g. TypeError: network error
      response = {ok: false, status: error}
    }
    if (!response.ok) {
      if (numRetries++ < maxRetries) {
        console.warn(`HTTP error ${response.status}, text content (200 chars cutoff): ${(await response.text?.()).slice(0,200)}... Trying again after a short delay...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      } else {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`)
      }
    }
  } while (!response.ok)
  return await response.json()
}

function initLightSwitch(stylesheetId, buttonId) {
  const stylesheet = document.getElementById(stylesheetId)
  const lightSwitch = document.getElementById(buttonId)
  function colorSchemeChange(dark) {
    if (typeof dark == 'string') dark = (dark == 'true')
    stylesheet.disabled = dark
    lightSwitch.innerText = dark ? 'Lights on 🌞' : 'Lights off 🌛'
    localStorage.setItem('dark', dark)
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', e => colorSchemeChange(e.matches))
  colorSchemeChange(localStorage.getItem('dark') ?? mql.matches)
  lightSwitch.addEventListener('click', () => colorSchemeChange(!stylesheet.disabled))
}
