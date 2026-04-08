const SUPABASE_URL = 'https://lftwjduikvoqcmhnlnej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdHdqZHVpa3ZvcWNtaG5sbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzc5ODAsImV4cCI6MjA5MDg1Mzk4MH0.tjoliaG-mCFwfJNabeUj3eTgq5kZ0F0QY3Z6klSDqkg';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;   
let currentMeta = null;   
let activeEssayId = null;
let allPublishedEssays = [];
const INDENT = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'; 

let navigationStack = ['home'];

function showPage(pageId, saveToHistory = true) {
  const currentActivePage = document.querySelector('.page.active');

  if (saveToHistory && currentActivePage && currentActivePage.id !== pageId) {
    navigationStack.push(currentActivePage.id);
  }

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
  const navBtn = document.getElementById('nav-btn');
    if (navBtn) {
        navBtn.style.display = (pageId === 'home') ? 'none' : 'flex';
    }
  
  document.getElementById('nav-btn').style.display = (pageId === 'home') ? 'none' : 'flex';
  window.scrollTo(0, 0);

  if (pageId === 'editor-page') {
    setupNotebook();
  }
  if (pageId === 'read') {
    loadPublishedLibrary();
  }
  if (pageId === 'writer-dash') {
    Promise.all([
      fetchUserEssays(),
      loadStudentResources(),
      loadStudentNotifications()
    ]);
  }
  if (pageId === 'reviewer-dash') {
    Promise.all([
      loadTeacherDashboard(),
      loadTeacherResources(),
      loadReviewerNotifications()
    ]);
  }
 if (saveToHistory) { window.history.pushState({ page: pageId }, "", `#${pageId}`); }
}

function openTeacherNotebook() {
  document.getElementById('essay-title').value = "";
  document.getElementById('essay-body').value = "";
  document.getElementById('word-num').innerText = "0";
  document.getElementById('autosave-status').innerText = "Personal Scratchpad Mode";
  
  showPage('editor-page');
  document.getElementById('btn-submit-essay').style.display = 'none';
  document.getElementById('teacher-controls').style.display = 'flex';
  document.getElementById('essay-title').value = "";
  document.getElementById('essay-body').value = "";
   
}

function openStudentNotebook() {
  document.getElementById('btn-submit-essay').style.display = 'block';
  document.getElementById('teacher-controls').style.display = 'none';
  document.getElementById('autosave-status').innerText = "Draft auto-saves every 30s";
  showPage('editor-page');
}

function goBack() {
  if (navigationStack.length > 0) {
    const previousPageId = navigationStack.pop();
    showPage(previousPageId, false);
  } else {
    showPage('home');
  }
}

async function performSignup(isTeacher) {
  const prefix   = isTeacher ? 'rev-' : '';
  const nameEl   = document.getElementById(`${prefix}reg-name`);
  const userEl   = document.getElementById(`${prefix}reg-user`);
  const emailEl  = document.getElementById(`${prefix}reg-email`);
  const passEl   = document.getElementById(`${prefix}reg-pass`);
  const msgEl    = document.getElementById(isTeacher ? 'rev-signup-msg' : 'signup-msg');

  const name     = nameEl.value.trim();
  const username = userEl.value.trim().toLowerCase().replace(/\s+/g, '');
  const email    = emailEl.value.trim().toLowerCase();
  const password = passEl.value;

 msgEl.innerHTML = '';

  if (!name || !username || !email || !password) {
    msgEl.innerHTML = '<p class="error-msg">Please fill in all required fields.</p>';
    return;
  }
  if (!email.includes('@')) {
    msgEl.innerHTML = '<p class="error-msg">Please enter a valid email address.</p>';
    return;
  }
  if (password.length < 6) {
    msgEl.innerHTML = '<p class="error-msg">Password must be at least 6 characters.</p>';
    return;
  }

  const confirmId = isTeacher ? 'rev-reg-confirm' : 'reg-confirm';
  const confirmEl = document.getElementById(confirmId);
  if (confirmEl && confirmEl.value !== password) {
    msgEl.innerHTML = '<p class="error-msg">Passwords do not match.</p>';
    return;
  }

  const metadata = {
    full_name: name,
    username:  username,
    role:      isTeacher ? 'reviewer' : 'student'
  };
  if (isTeacher) {
    metadata.profession = document.getElementById('rev-prof').value.trim();
    metadata.experience = document.getElementById('rev-exp').value;
  }

  msgEl.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">Creating account…</p>';

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: 'https://ajarnzandy-blip.github.io/kwaderno'
    }
  });

  if (error) {
    msgEl.innerHTML = `<p class="error-msg">Error: ${error.message}</p>`;
    return;
  }

  msgEl.innerHTML = '<p class="success-msg">✅ Account created! Use your email to log in.</p>';
}

async function performLogin(isTeacher) {
  const prefix   = isTeacher ? 'rev-' : '';
  const userEl   = document.getElementById(`${prefix}login-user`);
  const passEl   = document.getElementById(`${prefix}login-pass`);
  const msgEl    = document.getElementById(isTeacher ? 'rev-login-msg' : 'login-msg');
  const btnEl    = document.querySelector(`#${isTeacher ? 'reviewer-login' : 'login-page'} .btn-auth`);

  const email    = userEl.value.trim().toLowerCase();
  const password = passEl.value;

  msgEl.innerHTML = '';

  if (!email || !password) {
    msgEl.innerHTML = '<p class="error-msg">Please enter your email and password.</p>';
    return;
  }
  if (!email.includes('@')) {
    msgEl.innerHTML = '<p class="error-msg">Please enter a valid email address.</p>';
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<span class="spinner"></span> Logging in…'; }
  msgEl.innerHTML = '';
 const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) {
  if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = isTeacher ? 'Login as Reviewer' : 'Login'; }
  msgEl.innerHTML = `<p class="error-msg">Login failed: ${error.message}</p>`;
  return;
}

const { data: banCheck } = await sb
  .from('profiles')
  .select('banned, ban_reason')
  .eq('id', data.user.id)
  .single();

if (banCheck?.banned) {
  await sb.auth.signOut();
  alert(`Your account has been banned.\n\nReason: ${banCheck.ban_reason}\n\nIf you think this is a mistake, contact ajarn.zandy@gmail.com`);
  return;
}
  const role = data.user.user_metadata?.role;

  if (isTeacher && role !== 'reviewer' && role !== 'admin') {
    msgEl.innerHTML = '<p class="error-msg">This login is for reviewers only. Please use Student Login.</p>';
    await sb.auth.signOut();
    return;
  }
  if (!isTeacher && role === 'reviewer') {
    msgEl.innerHTML = '<p class="error-msg">Reviewers must use the Reviewer Portal login.</p>';
    await sb.auth.signOut();
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = isTeacher ? 'Login as Reviewer' : 'Login'; }
    return;
  }

  userEl.value = '';
  passEl.value = '';

  const { data: profile } = await sb
    .from('profiles')
    .select('banned, ban_reason')
    .eq('email', email)
    .single();

  if (profile?.banned) {
    msgEl.innerHTML = `<p class="error-msg">🚫 Your account has been suspended: <b>${profile.ban_reason || 'Violation of community guidelines'}</b>. Please contact the administrator.</p>`;
    await sb.auth.signOut();
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = isTeacher ? 'Login as Reviewer' : 'Login'; }
    return;
  }

  afterLogin(data.user);
}

function afterLogin(user) {
  currentUser = user;
  currentMeta = user.user_metadata || {};
  const name = currentMeta.full_name || currentMeta.username || 'User';
  const role = currentMeta.role;

  if (role === 'reviewer' || role === 'admin') {
    document.getElementById('rev-welcome').innerText = `Hello, ${name}!`;
    if (role === 'admin') {
    document.getElementById('admin-btn').style.display = 'block';
  } else {
    document.getElementById('admin-btn').style.display = 'none';
}
    showPage('reviewer-dash');
  } else {

    document.getElementById('welcome-msg').innerText = `Welcome, ${name}!`;
    showPage('writer-dash');
  }
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  currentMeta = null;
  activeEssayId = null;
  showPage('home');
}

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    afterLogin(session.user);
  } else {
    showPage('home');
  }
});

async function submitEssay() {
  if (!currentUser) { alert('You must be logged in.'); return; }
  const title = document.getElementById('essay-title').value.trim();
  const rawBody = document.getElementById('essay-body').value;
  const body = rawBody
    .split('\n')
    .map(line => line.replace(/[\u00A0\s]+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');
  if (!title) { alert('Please enter a title.'); return; }
  if (!body)  { alert('Please write something before submitting.'); return; }
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 50)  { alert(`Your essay is only ${wordCount} words. Please write at least 50 words before submitting.`); return; }
  if (wordCount > 900) { alert(`Your essay is ${wordCount} words. Please keep it under 900 words before submitting.`); return; }

  const isVIP = currentUser.role === 'reviewer' || currentUser.role === 'admin' || currentUser.role === 'teacher';
  const startingStatus = isVIP ? 'published' : 'submitted';

  // Fix 1: set published_at and revised_body when publishing directly
  const insertPayload = {
    student_id: currentUser.id,
    title: title,
    body: body,
    status: startingStatus,
    ...(isVIP && {
      published_at: new Date().toISOString(),
      revised_body: body  // mirrors body since no review step
    })
  };

  const { data, error } = await sb
    .from('essays')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    alert(error.message.includes('limit') ? error.message : 'Submit failed: ' + error.message);
    return;
  }

  if (data.status === 'published') {
    alert('Success! Since you are a reviewer, your essay has been published directly to the website! ✅');
  } else if (data.status === 'assigned') {
    alert('Success! Your essay has been submitted and assigned to a reviewer.');
  } else {
    alert('Success! Your essay is now on the waiting list for the next available reviewer.');
  }

  document.getElementById('essay-title').value = '';
  document.getElementById('essay-body').value = '';
  document.getElementById('word-num').innerText = '0';
  clearDraft();
  if (window._autosaveTimer) clearInterval(window._autosaveTimer);
  window.onbeforeunload = null;

  showPage('writer-dash');
}
async function fetchUserEssays() {
  if (!currentUser) return;

  const tbody = document.getElementById('user-essay-list');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;"><span class="spinner-dark"></span> Loading essays…</td></tr>';

  const { data: essays, error } = await sb
    .from('essays')
    .select('*')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchUserEssays:', error); return; }

  const statusLabel = {
    submitted: 'Submitted',
    assigned:  'Assigned',
    reviewing: 'Reviewing',
    returned:  'Returned ✉️',
    rewriting: 'Rewriting',
    published: 'Published ✅',
    pulled:    'Pulled 🚩'
  };

  tbody.innerHTML = essays.length === 0
    ? '<tr><td colspan="3" style="text-align:center; color:var(--muted);">No essays yet. Write one!</td></tr>'
    : essays.map(e => {
        // 1. Build the standard row
        let rowHtml = `
          <tr onclick="${e.status === 'published' ? `viewPublishedEssay('${e.id}')` : `openStudentEssay('${e.id}','${e.status}')`}" style="cursor:pointer;" title="Click to open">
            <td><b>${e.title}</b></td>
            <td>${new Date(e.created_at).toLocaleDateString()}</td>
            <td><span class="status-pill">${statusLabel[e.status] || e.status}</span></td>
          </tr>
        `;

        // 2. If it is pulled, append the extra warning row underneath!
        if (e.status === 'pulled') {
          rowHtml += `
            <tr style="background-color: #ffeaea; cursor: default;">
              <td colspan="3" style="padding: 10px; border-left: 4px solid #e74c3c;">
                <p style="color: #c0392b; margin: 0 0 5px 0; font-size: 0.85rem;"><strong>⚠️ Admin Note:</strong> ${e.pulled_reason || 'No reason provided.'}</p>
                <div>
                  <button onclick="editPulledEssay('${e.id}')" style="background:#2D6A4F; color:white; padding:4px 10px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">✏️ Edit</button>
                  <button onclick="discardPulledEssay('${e.id}')" style="background:#e74c3c; color:white; padding:4px 10px; border:none; border-radius:4px; cursor:pointer; margin-left:10px; font-size:0.8rem;">🗑️ Discard</button>
                </div>
              </td>
            </tr>
          `;
        }

        // 3. Return the combined HTML back to the map function
        return rowHtml;
      }).join('');
}
async function openStudentEssay(essayId, status) {
  if (status !== 'returned' && status !== 'rewriting') {
    alert(`This essay is currently "${status}". You can only open Returned essays.`);
    return;
  }
 
  await sb.from('essays').update({ status: 'rewriting' }).eq('id', essayId);
 
  const { data: essay, error } = await sb.from('essays').select('*, profiles!student_id(username, full_name)').eq('id', essayId).single();
  if (error) { alert('Could not load essay.'); return; }
 
  activeEssayId = essayId;
 
  document.getElementById('view-essay-title').innerText  = essay.title;
  document.getElementById('view-teacher-note').innerText = essay.teacher_notes || 'No general notes provided.';
 
  const corrPanel = document.getElementById('view-corrected-content');
  corrPanel.innerHTML = essay.corrected_content
    ? DOMPurify.sanitize(essay.corrected_content)
    : toHTML(essay.body);
  corrPanel.classList.add('essay-content');
 
  // in openStudentEssay()
const cleanBody = (essay.body || '').replace(/<[^>]*>/g, '');
document.getElementById('student-rewrite-body').value = cleanBody;
  document.getElementById('student-rewrite-body').classList.add('essay-content');

  document.getElementById('feedback-modal').style.display = 'block';
  fetchUserEssays();
}

function closeFeedback() {
  document.getElementById('feedback-modal').style.display = 'none';
}

async function publishEssay() {
  const polished = document.getElementById('student-rewrite-body').value.trim();
  if (!polished) {
    alert('Please write your rewritten essay before publishing.');
    return;
  }
  const wordCount = polished.split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) {
    alert(`Your rewrite is only ${wordCount} words. Please write at least 50 words before publishing.`);
    return;
  }
  const original = (document.getElementById('view-corrected-content')?.innerText || '').trim().replace(/\s+/g, ' ');
  const rewrite  = polished.trim().replace(/\s+/g, ' ');
  if (original && original === rewrite) {
    alert('Your rewrite appears unchanged. Please incorporate your teacher\'s corrections before publishing.');
    return;
  }
  if (!confirm('Are you sure you want to publish? This cannot be undone.')) return;

  const { error } = await sb.rpc('publish_essay', {
    essay_id: activeEssayId,
    polished_body: polished
  });

  if (error) { alert('Publish failed: ' + error.message); return; }

  alert('Congratulations! Your essay is now published to the library.');
  document.getElementById('feedback-modal').style.display = 'none';
  fetchUserEssays();
}
async function viewPublishedEssay(essayId) {
  const { data: essay, error } = await sb
    .from('essays')
    .select(`
      *,
      student:profiles!student_id(username, full_name),
      teacher:profiles!teacher_id(username, full_name)
    `) // Fix 1: join both profiles like loadPublishedLibrary
    .eq('id', essayId)
    .single();

  if (error) { alert('Could not load essay.'); return; }

  // Fix 2: author resolved from either profile
  const authorProfile = essay.student || essay.teacher;
  const author = authorProfile?.full_name || authorProfile?.username || 'Anonymous';

  const win = window.open('', '_blank');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${essay.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 0in auto; padding: 20px; color: #1f1f1f; line-height: 1.8; }
        h1 { text-align: center; color: #1B4332; border-bottom: 1px solid #1B4332; padding-bottom: -1.0px; margin-bottom: 0.1in; }
        .meta { text-align: center; color: #888; margin: 0.5px 0; font-size: 0.9rem; }
        .meta:last-of-type { margin-bottom: 0.2in; }
        .body { font-size: 1.1rem; }
        .essay-content p { text-indent: 1in; margin: 0; line-height: 2.5rem; font-family: 'Palatino Linotype', 'Palatino', serif; font-size: 1.1rem; }
        .print-btn { display: block; margin: 30px auto; padding: 10px 30px; background: #1B4332; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
        @media print { .print-btn { display: none; } }
      </style>
    </head>
    <body>
      <h1>${essay.title}</h1>
      <p class="meta">By <b>${author}</b></p>
      <p class="meta">Published on ${new Date(essay.published_at || essay.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
      <div class="body essay-content">${toHTML(essay.revised_body || essay.body)}</div>
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </body>
    </html>
  `);
  win.document.close();
}
async function loadTeacherDashboard() {
  if (!currentUser) return;

  // 1. Fetch the reviewer's true availability from the database
  const { data: profile } = await sb
    .from('profiles')
    .select('is_available')
    .eq('id', currentUser.id)
    .single();

  // Sync the UI Checkbox so it accurately reflects the database
  const availCheckbox = document.getElementById('rev-avail');
  if (profile && availCheckbox) {
    availCheckbox.checked = profile.is_available;
  }

  // 2. Adjust which essays they see based on their availability
  let query = sb.from('essays').select('*').order('created_at', { ascending: false });

  if (profile && profile.is_available === false) {
    // If UNAVAILABLE: Only show essays they are already reviewing or have returned
    query = query.eq('teacher_id', currentUser.id);
  } else {
    // If AVAILABLE: Show their assigned essays PLUS all new unassigned essays
    query = query.or(`teacher_id.eq.${currentUser.id},status.eq.submitted`);
  }

  const { data: essays, error } = await query;

  if (error) { console.error('loadTeacherDashboard:', error); return; }

  const pending   = document.getElementById('assigned-list');
  const completed = document.getElementById('completed-list');
  pending.innerHTML = '<p style="color:var(--muted);"><span class="spinner-dark"></span> Loading…</p>';
  completed.innerHTML = ''; 

  const statusLabel = {
    submitted: 'New 📥',
    assigned:  'Opened',
    reviewing: 'Checking',
    returned:  'Returned',
    published: 'Published',
    rejected:  'Rejected ❌'
  };

  let doneCount = 0;

  essays.forEach(essay => {
    const label = statusLabel[essay.status] || essay.status;
    const isLocked = essay.status === 'returned' || essay.status === 'rewriting' || essay.status === 'published';

    const card = `
      <div class="reviewer-card" 
        onclick="${isLocked ? 'void(0)' : `openReviewEditor('${essay.id}')`}" 
        style="cursor:${isLocked ? 'default' : 'pointer'}; opacity:${isLocked ? '0.5' : '1'}; border-left-color:${isLocked ? '#bdc3c7' : 'var(--deep-green)'};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${essay.title}</strong>
          <span class="status-pill">${label}</span>
        </div>
        <small style="color:var(--muted);">${new Date(essay.created_at).toLocaleDateString()}</small>
        ${isLocked ? '<small style="color:#c0392b; font-style:italic;">🔒 Locked — returned to student</small>' : ''}
      </div>`;

    if (isLocked) {
      completed.innerHTML += card;
      doneCount++;
    } else {
      pending.innerHTML += card;
    }
  });
  if (pending.innerHTML === '')   pending.innerHTML   = '<p style="color:var(--muted); font-size:0.9rem;">No pending essays.</p>';
  if (completed.innerHTML === '') completed.innerHTML = '<p style="color:var(--muted); font-size:0.9rem;">No completed reviews yet.</p>';
  document.getElementById('finish-count').innerText = doneCount;
}

async function openReviewEditor(essayId) {
  const { data: check } = await sb.from('essays').select('status').eq('id', essayId).single();
  
  if (!check) { alert('Could not load essay.'); return; }
  
  if (check.status === 'returned' || check.status === 'rewriting' || check.status === 'published') {
    alert('This essay has already been returned to the student and is locked.');
    return;
  }
  
  await sb.from('essays').update({ status: 'reviewing', teacher_id: currentUser.id }).eq('id', essayId);
  const { data: essay, error } = await sb.from('essays').select('*').eq('id', essayId).single();
  if (error) { console.error('openReviewEditor:', error); return; }

  activeEssayId = essayId;
  document.getElementById('editing-title').innerText = `Proofreading: ${essay.title}`;

  // 1. LEFT PANEL: Shows the student's original text (Read-only)
  const origPanel = document.getElementById('student-original-content');
  // Use toHTML to ensure the original body shows up with proper line breaks
  origPanel.innerHTML = DOMPurify.sanitize(toHTML(essay.body));
  origPanel.classList.add('essay-content');

  // 2. RIGHT PANEL (Reviewer Panel): This is where the teacher edits
  const box = document.getElementById('teacher-correction-content');
  
  // PROBLEM WAS HERE: It was looking for revised_body. 
  // FIX: If the teacher already saved progress, use corrected_content.
  // Otherwise, use the original student 'body' so the teacher has text to edit.
  if (essay.corrected_content) {
    box.innerHTML = DOMPurify.sanitize(essay.corrected_content);
  } else {
    // This loads the student's original work into the editable box
    box.innerHTML = toHTML(essay.body); 
  }

  document.getElementById('teacher-comments').value = essay.teacher_notes || '';

  showPage('review-editor');
}

// Ensure this helper function exists to handle the text-to-html conversion
function toHTML(text) {
  if (!text) return "";
  return text.split('\n').map(para => `<div>${para}</div>`).join('');
}

async function saveReview() {
  const notes     = document.getElementById('teacher-comments').value;
  const corrected = document.getElementById('teacher-correction-content').innerHTML;

  const { error } = await sb.from('essays').update({
    status:            'returned',
    teacher_notes:     notes,
    corrected_content: corrected
  }).eq('id', activeEssayId);

  if (error) { alert('Save failed: ' + error.message); return; }

  alert('Essay returned to student!');
  showPage('reviewer-dash');
}

async function loadPublishedLibrary() {
  const listEl = document.getElementById('essay-list');
  listEl.innerHTML = '<p style="text-align:center; color:var(--muted);"><span class="spinner-dark"></span> Loading polished works…</p>';

  const { data, error } = await sb
    .from('essays')
    .select(`
  *,
  student:profiles!student_id(username, full_name),
  teacher:profiles!teacher_id(username, full_name)
`)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<p style="color:red; text-align:center;">Could not load essays. Check console.</p>';
    console.error('loadPublishedLibrary:', error);
    return;
  }

  allPublishedEssays = data;
  renderLibrary(data);
}

function renderLibrary(essays) {
  const listEl = document.getElementById('essay-list');
  if (!essays || essays.length === 0) {
    listEl.innerHTML = '<p style="text-align:center; color:var(--muted);">No published essays yet. Be the first!</p>';
    return;
  }

  listEl.innerHTML = essays.map(e => {
    const date = new Date(e.published_at || e.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const rawBody = e.revised_body || e.body || '';
    const preview = DOMPurify.sanitize(rawBody.replace(/<[^>]*>/g, '').replace(/[\u00A0]/g, ' ').substring(0, 150));

    // Use student as author first, fall back to teacher if no student
    const authorProfile = e.student || e.teacher;
    const author = authorProfile?.full_name || authorProfile?.username || 'Anonymous';

    return `
      <div class="essay-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h3 style="margin:0 0 5px 0; color:var(--deep-green);">${DOMPurify.sanitize(e.title)}</h3>
            <span style="font-size:0.8rem; color:var(--muted);">By <b>${author}</b> · Published on <b>${date}</b></span>
          </div>
          <div data-essay-id="${e.id}" style="background:var(--paper); padding:4px 10px; border-radius:20px; border:1px solid var(--border); font-size:0.75rem; font-weight:700; color:var(--deep-green); white-space:nowrap;">
            👁️ ${e.views || 0} Views
          </div>
        </div>
        <p style="font-size:0.9rem; color:#444; margin:15px 0;">${preview}…</p>
        <button class="btn-read-more" onclick="readFullEssay('${e.id}')">Read Full Essay</button>
      </div>`;
  }).join('');
}

function handleSearch(query) {
  const q = query.toLowerCase();
  const filtered = allPublishedEssays.filter(e => e.title.toLowerCase().includes(q));
  renderLibrary(filtered);
}

function sortEssays(val) {
  const sorted = [...allPublishedEssays];
  if (val === 'oldest') sorted.sort((a,b) => new Date(a.published_at||a.created_at) - new Date(b.published_at||b.created_at));
  else if (val === 'views') sorted.sort((a,b) => (b.views||0) - (a.views||0));
  else sorted.sort((a,b) => new Date(b.published_at||b.created_at) - new Date(a.published_at||a.created_at));
  renderLibrary(sorted);
}

async function readFullEssay(essayId) {
  const { data: essay, error } = await sb
    .from('essays')
    .select(`
      *,
      student:profiles!student_id(username, full_name),
      teacher:profiles!teacher_id(username, full_name)
    `) // Fix 2: dual join
    .eq('id', essayId)
    .single();

  if (error) { alert('Could not load essay.'); return; }

  // Fix 1: use RPC instead of direct update to avoid 403
  const isOwnEssay = currentUser && currentUser.id === essay.student_id;
  if (!isOwnEssay) {
    await sb.rpc('increment_views', { essay_id: essayId });
  }

  const displayDate = new Date(essay.published_at || essay.created_at)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Fix 4: full_name fallback
  const authorProfile = essay.student || essay.teacher;
  const author = authorProfile?.full_name || authorProfile?.username || 'Anonymous';

  document.getElementById('full-read-title').innerText = essay.title;
  document.getElementById('full-read-date').innerText = displayDate;
  document.getElementById('full-read-author').innerText = author;

  const readPanel = document.getElementById('full-read-body');

  // Fix 3: fallback to body if revised_body is null
  const rawContent = essay.revised_body || essay.body || '';
  const content = typeof toHTML === 'function' ? toHTML(rawContent) : rawContent;
  readPanel.innerHTML = DOMPurify.sanitize(content);
  readPanel.classList.add('essay-content');

  document.getElementById('read-modal').style.display = 'block';

  // Background UI update for views
  if (!isOwnEssay) {
    const entry = allPublishedEssays.find(e => e.id === essayId);
    if (entry) {
      entry.views = (entry.views || 0) + 1;
      const viewBadges = document.querySelectorAll(`[data-essay-id="${essayId}"]`);
      viewBadges.forEach(badge => badge.innerText = `👁️ ${entry.views} Views`);
    }
  }
}

function updateFontStyle() {
  const val  = document.getElementById('font-style').value;
  const body = document.getElementById('essay-body');
  body.classList.toggle('cursive-font', val === 'cursive');
}

function updateStats() {
  const raw   = document.getElementById('essay-body').value;
  const text  = raw.replace(/[\u00A0]/g, '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const counter = document.getElementById('word-num');
  counter.innerText = words;
  counter.style.color = words > 900 ? '#c0392b' : words > 800 ? '#e67e22' : 'var(--deep-green)';
}

function validateTitle(input) {
  const words = input.value.trim().split(/\s+/).filter(Boolean);
  const atLimit = words.length >= 12;
  
  input.onkeydown = atLimit ? (e) => {
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter'];
    if (!allowed.includes(e.key)) e.preventDefault();
  } : null;

  if (words.length > 12) {
    input.value = words.slice(0, 12).join(' ');
  }
}

function applyMark(command, value = null) {
    const editor = document.getElementById('teacher-correction-content');
    editor.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const selectedText = range.toString();
    let node;

    if (command === 'strikeThrough') {
        node = document.createElement('s');
        node.style.color = 'red';
        node.textContent = selectedText;
    } else if (command === 'foreColor') {
        node = document.createElement('span');
        node.style.color = value;
        node.textContent = selectedText;
    } else if (command === 'hiliteColor') {
        node = document.createElement('span');
        node.style.backgroundColor = value;
        node.textContent = selectedText;
    }

    if (node) {
        range.deleteContents();
        range.insertNode(node);
        selection.removeAllRanges();
    }
}

function openSettings() {
  const name = currentMeta?.full_name || currentMeta?.username || currentUser?.email || '—';
  document.getElementById('settings-user-display').innerText = `Logged in as: ${name}`;
  document.getElementById('settings-msg').innerHTML = '';
  document.getElementById('settings-modal').style.display = 'block';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

async function updatePassword() {
  const np  = document.getElementById('new-pass').value;
  const cnp = document.getElementById('confirm-new-pass').value;
  const msg = document.getElementById('settings-msg');

  if (np.length < 6) { msg.innerHTML = '<p class="error-msg">Password must be at least 6 characters.</p>'; return; }
  if (np !== cnp)    { msg.innerHTML = '<p class="error-msg">Passwords do not match.</p>'; return; }

  const { error } = await sb.auth.updateUser({ password: np });
  if (error) { msg.innerHTML = `<p class="error-msg">${error.message}</p>`; return; }

  msg.innerHTML = '<p class="success-msg">✅ Password updated!</p>';
  document.getElementById('new-pass').value = '';
  document.getElementById('confirm-new-pass').value = '';
  setTimeout(() => closeSettings(), 1500);
}

let allStudentResources = [];
let showingAllResources = false;
 
async function loadStudentResources() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false });
 
  if (error) { console.error('loadStudentResources:', error); return; }
 
  allStudentResources = data;
  renderStudentResources();
}
 
function renderStudentResources() {
  const ul      = document.getElementById('student-resources');
  const moreBtn = document.getElementById('view-more-resources');
 
  if (!allStudentResources || allStudentResources.length === 0) {
    ul.innerHTML = '<li style="color:var(--muted); font-size:0.8rem;">No resources shared yet.</li>';
    moreBtn.style.display = 'none';
    return;
  }
 
  const visible = showingAllResources
    ? allStudentResources
    : allStudentResources.slice(0, 5);
 
  ul.innerHTML = visible.map(r => `
    <li style="margin-bottom:6px;">
      <a href="${r.url}" target="_blank" rel="noopener noreferrer"
         style="display:block; padding:8px 10px; border-radius:6px; border:1px solid var(--border); text-decoration:none; color:var(--deep-green); font-size:0.85rem; transition:background 0.2s;"
         onmouseover="this.style.background='#e3f2fd'"
         onmouseout="this.style.background='transparent'">
        🔗 ${r.title}
      </a>
    </li>
  `).join('');
 
  if (allStudentResources.length > 5) {
    moreBtn.style.display = 'block';
    moreBtn.innerText = showingAllResources
      ? '← Show Less'
      : `View More (${allStudentResources.length - 5} more) →`;
  } else {
    moreBtn.style.display = 'none';
  }
}
 
function toggleAllResources(e) {
  e.preventDefault();
  showingAllResources = !showingAllResources;
  renderStudentResources();
}
 
async function loadTeacherResources() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('resources')
    .select('*')
    .eq('teacher_id', currentUser.id);

  if (error) { console.error('loadTeacherResources:', error); return; }

  const ul = document.getElementById('teacher-resource-list');

  if (!data || data.length === 0) {
    ul.innerHTML = '<li style="color:var(--muted); font-size:0.85rem;">No links posted yet.</li>';
    return;
  }

ul.innerHTML = data.map(r => `
    <li style="display:flex; align-items:center; margin-bottom:4px; width:100%; list-style:none;">
      
      <a href="${r.url}" target="_blank" rel="noopener noreferrer"
         style="flex:1; padding:8px 10px; text-decoration:none; color:var(--deep-green); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:6px; transition:background 0.2s;"
         onmouseover="this.style.background='#e3f2fd'" 
         onmouseout="this.style.background='transparent'">
        🔗 ${r.title}
      </a>
      
      </li>
  `).join('');
}
async function publishResource() {
  const title  = document.getElementById('new-link-title').value.trim();
  const url    = document.getElementById('new-link-url').value.trim();
  const msgEl  = document.getElementById('resource-msg');
 
  msgEl.innerHTML = '';
 
  if (!title || !url) {
    msgEl.innerHTML = '<span style="color:#c0392b;">Please fill in both fields.</span>';
    return;
  }
  if (!url.startsWith('http')) {
    msgEl.innerHTML = '<span style="color:#c0392b;">URL must start with https://</span>';
    return;
  }
 
  const { error } = await sb.from('resources').insert([{
    teacher_id: currentUser.id,
    title,
    url
  }]);
 
  if (error) {
    msgEl.innerHTML = `<span style="color:#c0392b;">Error: ${error.message}</span>`;
    return;
  }
 
  document.getElementById('new-link-title').value = '';
  document.getElementById('new-link-url').value   = '';
  msgEl.innerHTML = '<span style="color:var(--deep-green);">✅ Posted!</span>';
 
  loadTeacherResources(); // refresh teacher list immediately
}
 
async function deleteResource(resourceId) {
  if (!confirm('Delete this resource link?')) return;
 
  const { error } = await sb.from('resources').delete().eq('id', resourceId);
 
  if (error) {
    alert('Delete failed: ' + error.message);
    return;
  }
 
  loadTeacherResources(); // refresh immediately
}

function handleTitleEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  
  const body = document.querySelector('#editor-page .notebook-paper textarea');
  if (!body) return;

  if (body.value.trim() === '') {
    body.value = INDENT;
  }
  
  setTimeout(() => {
    body.focus();
    body.setSelectionRange(body.value.length, body.value.length);
  }, 10);
}

async function loadStudentNotifications() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from('essays')
    .select('id')
    .eq('student_id', currentUser.id)
    .in('status', ['returned', 'rewriting']);

  if (error) { console.error('studentNotif:', error); return; }

  const banner = document.getElementById('student-notification');
  const count  = data ? data.length : 0;

  if (count === 0) {
    banner.style.display = 'none';
    return;
  }

  const grammar = count === 1
    ? 'YOUR ESSAY HAS BEEN RETURNED.'
    : `YOUR ${count} ESSAYS HAVE BEEN RETURNED.`;

  banner.innerHTML = `<span>${grammar}</span>`;
  banner.style.display = 'block';
}

async function loadReviewerNotifications() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from('essays')
    .select('id')
    .eq('teacher_id', currentUser.id)
    .in('status', ['assigned', 'submitted']);

  if (error) { console.error('reviewerNotif:', error); return; }

  const banner = document.getElementById('reviewer-notification');
  const count  = data ? data.length : 0;

  if (count === 0) {
    banner.style.display = 'none';
    return;
  }

  const grammar = count === 1
    ? '1 NEW ESSAY HAS BEEN ASSIGNED TO YOU.📥'
    : `${count} NEW ESSAYS HAVE BEEN ASSIGNED TO YOU.📥`;

  banner.innerHTML = `<span>${grammar}</span>`;
  banner.style.display = 'block';
}
function setupNotebook() {
  const body = document.getElementById('essay-body');
  if (!body) return;

  document.getElementById('essay-title').value = '';
  document.getElementById('word-num').innerText = '0';

  const fresh = body.cloneNode(true);
  fresh.id = 'essay-body';
  fresh.value = '';
  body.parentNode.replaceChild(fresh, body);

  fresh.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const start = fresh.selectionStart;
      const end   = fresh.selectionEnd;
      fresh.value = fresh.value.substring(0, start) + '\n' + INDENT + fresh.value.substring(end);
      const newPos = start + 1 + INDENT.length;
      fresh.setSelectionRange(newPos, newPos);
      updateStats();
    }
  });

  fresh.addEventListener('paste', (e) => {
    e.preventDefault();
    showPasteToast(e);
  });

  fresh.addEventListener('input', updateStats);

  fresh.addEventListener('click', () => {
    if (fresh.value.trim() === '') {
      fresh.value = INDENT;
      fresh.setSelectionRange(fresh.value.length, fresh.value.length);
    }
  });

  fresh.addEventListener('focus', () => {
    if (fresh.value.trim() === '') {
      fresh.value = INDENT;
      fresh.setSelectionRange(fresh.value.length, fresh.value.length);
    }
  });

  setTimeout(() => document.getElementById('essay-title').focus(), 50);

  loadDraft();
  if (window._autosaveTimer) clearInterval(window._autosaveTimer);
  window._autosaveTimer = setInterval(saveDraft, 30000);

  window.onbeforeunload = (e) => {
    const val = document.getElementById('essay-body')?.value?.trim();
    if (val && val !== INDENT.trim()) {
      saveDraft();
      e.preventDefault();
      e.returnValue = '';
    }
  };
}

function toHTML(text) {
  if (!text) return '';
  if (text.trim().startsWith('<')) return text;
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line}</p>`)
    .join('');
}

const DRAFT_KEY = 'kwaderno_draft';

function saveDraft() {
  const title = document.getElementById('essay-title')?.value;
  const body  = document.getElementById('essay-body')?.value;
  if (!title && !body) return;

  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    title: title || '',
    body:  body  || '',
    savedAt: new Date().toISOString()
  }));

  const status = document.getElementById('autosave-status');
  if (status) {
    status.innerText = '✅ Draft saved ' + new Date().toLocaleTimeString();
    setTimeout(() => {
      status.innerText = 'Draft auto-saves every 30s';
    }, 2000);
  }
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    if (!draft.title && !draft.body) return;

    const savedAt = new Date(draft.savedAt).toLocaleString();
    const banner  = document.getElementById('draft-banner');
    const msg     = document.getElementById('draft-banner-msg');

    msg.innerText = `You have an unsaved draft from ${savedAt}.`;
    banner.style.display = 'flex';

    window._pendingDraft = draft;
  } catch(e) {
    console.error('Draft restore error:', e);
  }
}

function restoreDraft() {
  const draft = window._pendingDraft;
  if (!draft) return;

  document.getElementById('essay-title').value = draft.title || '';
  const body = document.getElementById('essay-body');
  body.value = draft.body || '';
  updateStats();

  document.getElementById('draft-banner').style.display = 'none';
  window._pendingDraft = null;
}

function discardDraft() {
  clearDraft();
  window._pendingDraft = null;
  document.getElementById('draft-banner').style.display = 'none';
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

async function sendPasswordReset() {
  const email  = document.getElementById('reset-email').value.trim().toLowerCase();
  const msgEl  = document.getElementById('reset-msg');

  msgEl.innerHTML = '';

  if (!email) {
    msgEl.innerHTML = '<p class="error-msg">Please enter your email address.</p>';
    return;
  }
  if (!email.includes('@')) {
    msgEl.innerHTML = '<p class="error-msg">Please enter a valid email address.</p>';
    return;
  }

  msgEl.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">Sending reset link…</p>';

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://ajarnzandy-blip.github.io/kwaderno'
  });

  if (error) {
    msgEl.innerHTML = `<p class="error-msg">Error: ${error.message}</p>`;
    return;
  }

  msgEl.innerHTML = '<p class="success-msg">✅ Reset link sent! Please check your email. The link expires in 1 hour.</p>';
  document.getElementById('reset-email').value = '';
}

let allAdminUsers = [];
let activeBanUserId = null;
let activeResetUserId = null;

async function loadAdminPanel() {
  if (!currentUser || currentMeta?.role !== 'admin') {
    showPage('home');
    return;
  }
  await Promise.all([
    loadAdminUsers(),
    loadAdminEssays(),
    loadAdminStats()
  ]);
}

async function loadAdminStats() {
  const [users, essays, published, banned] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('essays').select('*', { count: 'exact', head: true }),
    sb.from('essays').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true)
  ]);

  document.getElementById('admin-stat-users').innerText     = users.count ?? '—';
  document.getElementById('admin-stat-essays').innerText    = essays.count ?? '—';
  document.getElementById('admin-stat-published').innerText = published.count ?? '—';
  document.getElementById('admin-stat-banned').innerText    = banned.count ?? '—';
}

async function loadAdminUsers() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadAdminUsers:', error); return; }

  allAdminUsers = data;
  renderAdminUsers(data);
}

function renderAdminUsers(users) {
  const el = document.getElementById('admin-user-list');
  if (!users || users.length === 0) {
    el.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">No users found.</p>';
    return;
  }
  el.innerHTML = users.map(u => `
    <div style="padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; background:${u.banned ? '#fff5f5' : 'white'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <b style="font-size:0.9rem; color:var(--deep-green);">${u.full_name || '—'}</b>
          <span style="font-size:0.75rem; color:var(--muted);"> @${u.username || '—'}</span><br>
          <span style="font-size:0.75rem; color:var(--muted);">${u.email || '—'}</span><br>
          <span style="font-size:0.72rem; background:${u.role === 'admin' ? '#1B4332' : u.role === 'reviewer' ? '#2F3E46' : '#eee'}; color:${u.role === 'admin' || u.role === 'reviewer' ? 'white' : 'var(--ink)'}; padding:2px 8px; border-radius:10px;">${u.role}</span>
          ${u.banned ? `<span style="font-size:0.72rem; background:#c0392b; color:white; padding:2px 8px; border-radius:10px; margin-left:4px;">BANNED</span>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:5px; flex-shrink:0;">
          ${u.role !== 'admin' ? `
            <button onclick="openBanModal('${u.id}', '${(u.full_name || u.username || '').replace(/'/g, '')}')" 
              style="font-size:0.75rem; padding:4px 8px; border-radius:5px; border:none; cursor:pointer; background:${u.banned ? '#27ae60' : '#c0392b'}; color:white; font-weight:700;">
              ${u.banned ? 'Unban' : 'Ban'}
            </button>
            <button onclick="openResetModal('${u.id}', '${(u.full_name || u.username || '').replace(/'/g, '')}')"
              style="font-size:0.75rem; padding:4px 8px; border-radius:5px; border:1px solid #ddd; cursor:pointer; background:white; color:var(--deep-green); font-weight:700;">
              🔑 Reset
            </button>
          ` : ''}
        </div>
      </div>
      ${u.banned && u.ban_reason ? `<div style="margin-top:6px; font-size:0.75rem; color:#c0392b; font-style:italic;">Reason: ${u.ban_reason}</div>` : ''}
    </div>
  `).join('');
}

function filterAdminUsers(query) {
  const q = query.toLowerCase();
  const filtered = allAdminUsers.filter(u =>
    (u.full_name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.username || '').toLowerCase().includes(q)
  );
  renderAdminUsers(filtered);
}

async function loadAdminEssays() {
  const { data, error } = await sb
    .from('essays')
    .select('id, title, status, created_at, student_id')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadAdminEssays:', error); return; }

  renderAdminEssays('admin-essays-published', data);
}

function renderAdminEssays(containerId, essays) {
  const el = document.getElementById(containerId);
  if (!essays || essays.length === 0) {
    el.innerHTML = '<p style="color:var(--muted); font-size:0.75rem; text-align:center;">No published essays yet.</p>';
    return;
  }
  el.innerHTML = essays.map(e => `
    <div onclick="openAdminEssayModal('${e.id}')" style="padding:10px 14px; border:1px solid var(--border); border-radius:8px; background:white; cursor:pointer; transition:0.2s;"
      onmouseover="this.style.borderColor='var(--squash)'; this.style.background='#fffbf6';"
      onmouseout="this.style.borderColor='var(--border)'; this.style.background='white';">
      <b style="font-size:0.85rem; color:var(--deep-green); display:block;">${e.title}</b>
      <span style="font-size:0.72rem; color:var(--muted);">${new Date(e.created_at).toLocaleDateString()}</span>
    </div>
  `).join('');
}

let adminActiveEssayId = null;

async function openAdminEssayModal(essayId) {
  adminActiveEssayId = essayId;

  const { data: essay, error } = await sb
    .from('essays')
    .select('id, title, body, corrected_content, revised_body')
    .eq('id', essayId)
    .single();

  if (error) { alert('Could not load essay.'); return; }

  document.getElementById('admin-essay-modal-title').innerText = essay.title;

  const corrPanel = document.getElementById('admin-essay-corrected');
  corrPanel.innerHTML = essay.corrected_content
    ? DOMPurify.sanitize(essay.corrected_content)
    : '<p style="color:var(--muted); font-style:italic;">No corrections recorded.</p>';

  const pubPanel = document.getElementById('admin-essay-published');
  pubPanel.innerHTML = DOMPurify.sanitize(toHTML(essay.revised_body));
  pubPanel.classList.add('essay-content');

  document.getElementById('admin-essay-modal').style.display = 'block';
}

function closeAdminEssayModal() {
  document.getElementById('admin-essay-modal').style.display = 'none';
  adminActiveEssayId = null;
}
function adminDeleteFromModal() {
  if (!adminActiveEssayId) return;
  const title = document.getElementById('admin-essay-modal-title').innerText;
  const essayId = adminActiveEssayId; // ← save it first
  closeAdminEssayModal();
  openPullModal(essayId, title); // ← use saved value
}
function openBanModal(userId, userName) {
  activeBanUserId = userId;
  const user = allAdminUsers.find(u => u.id === userId);
  document.getElementById('ban-user-name').innerText = userName;
  document.getElementById('ban-msg').innerHTML = '';
  document.getElementById('ban-reason-select').value = '';
  document.getElementById('ban-reason-other').style.display = 'none';
  document.getElementById('ban-reason-other').value = '';

  if (user?.banned) {
    if (confirm(`Unban ${userName}?`)) unbanUser(userId);
    return;
  }
  document.getElementById('ban-modal').style.display = 'block';
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'ban-reason-select') {
    document.getElementById('ban-reason-other').style.display =
      e.target.value === 'Other' ? 'block' : 'none';
  }
  if (e.target.id === 'pull-reason-select') {
    document.getElementById('pull-reason-other').style.display =
      e.target.value === 'Other' ? 'block' : 'none';
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    // check which page is active, then call the right function
    if (document.getElementById('login-page').classList.contains('active')) performLogin(false);
    if (document.getElementById('reviewer-login').classList.contains('active')) performLogin(true);
    if (document.getElementById('signup-page').classList.contains('active')) performSignup(false);
    // etc.
  }
if (e.key === 'Escape') {
    closeSettings();
    closeFeedback();
    closeNotebook();
  }
});

async function confirmBan() {
  console.log('activeBanUserId:', activeBanUserId); // keep this line only for now
  const select = document.getElementById('ban-reason-select').value;
  const other  = document.getElementById('ban-reason-other').value.trim();
  const reason = select === 'Other' ? other : select;
  const msgEl  = document.getElementById('ban-msg');
  if (!reason) {
    msgEl.innerHTML = '<p class="error-msg">Please select or enter a reason.</p>';
    return;
  }
  const { error } = await sb
    .from('profiles')
    .update({ banned: true, ban_reason: reason })
    .eq('id', activeBanUserId);
  if (error) { msgEl.innerHTML = `<p class="error-msg">${error.message}</p>`; return; }
  closeBanModal();
  await Promise.all([loadAdminUsers(), loadAdminStats()]);
}

async function unbanUser(userId) {
  const { error } = await sb
    .from('profiles')
    .update({ banned: false, ban_reason: null })
    .eq('id', userId);

  if (error) { alert('Unban failed: ' + error.message); return; }
  await Promise.all([loadAdminUsers(), loadAdminStats()]);
}

function closeBanModal() {
  document.getElementById('ban-modal').style.display = 'none';
  activeBanUserId = null;
}

function openResetModal(userId, userName) {
  activeResetUserId = userId;
  document.getElementById('reset-user-name').innerText = userName;
  document.getElementById('admin-new-password').value  = '';
  document.getElementById('admin-confirm-password').value = '';
  document.getElementById('admin-reset-msg').innerHTML = '';
  document.getElementById('admin-reset-modal').style.display = 'block';
}

async function confirmAdminPasswordReset() {
  const np    = document.getElementById('admin-new-password').value;
  const cnp   = document.getElementById('admin-confirm-password').value;
  const msgEl = document.getElementById('admin-reset-msg');

  if (np.length < 6) {
    msgEl.innerHTML = '<p class="error-msg">Password must be at least 6 characters.</p>';
    return;
  }
  if (np !== cnp) {
    msgEl.innerHTML = '<p class="error-msg">Passwords do not match.</p>';
    return;
  }

  msgEl.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;"><span class="spinner"></span> Resetting…</p>';

  const { data: { session } } = await sb.auth.getSession();

  const res = await fetch(
    'https://lftwjduikvoqcmhnlnej.supabase.co/functions/v1/rapid-handler',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ targetid: activeResetUserId, newPassword: np })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    msgEl.innerHTML = `<p class="error-msg">Failed: ${text}</p>`;
    return;
  }

  msgEl.innerHTML = '<p class="success-msg">✅ Password updated! Inform the user of their new password.</p>';
  setTimeout(() => closeResetModal(), 2000);
}
function closeResetModal() {
  document.getElementById('admin-reset-modal').style.display = 'none';
  activeResetUserId = null;
}
function showPasteToast(e) {
  if (e) e.preventDefault();
  const toast = document.getElementById('paste-toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
let activePullEssayId = null;

function openPullModal(essayId, essayTitle) {
  activePullEssayId = essayId; 
  document.getElementById('pull-essay-title').innerText = essayTitle;
  document.getElementById('pull-msg').innerHTML = '';
  document.getElementById('pull-reason-select').value = '';
  document.getElementById('pull-reason-other').style.display = 'none';
  document.getElementById('pull-reason-other').value = '';
  document.getElementById('pull-modal').style.display = 'block'; } 

async function confirmPull() {
  const select = document.getElementById('pull-reason-select').value;
  const other  = document.getElementById('pull-reason-other').value.trim();
  const reason = select === 'Other' ? other : select;
  const msgEl  = document.getElementById('pull-msg');
  if (!reason) {
    msgEl.innerHTML = '<p class="error-msg">Please select or enter a reason.</p>';
    return;
  }
  const { error } = await sb.rpc('pull_essay', {
    essay_id: activePullEssayId,
    reason: reason
  });
  if (error) { msgEl.innerHTML = `<p class="error-msg">${error.message}</p>`; return; }

  // Inline instead of calling closePullModal()
  document.getElementById('pull-modal').style.display = 'none';
  activePullEssayId = null;

  alert('Success! The essay was pulled and returned to the student.');
  await Promise.all([loadAdminEssays(), loadAdminStats()]);
}
async function discardPulledEssay(essayId) {
  const confirmDiscard = confirm("Are you sure you want to discard this essay? It will be sent to the shadow realm forever.");
  if (!confirmDiscard) return;
  const { error } = await sb.rpc('discard_essay', { essay_id: essayId });
  if (error) {
    alert('Failed to discard essay: ' + error.message);
    return;
  }
  alert('Essay successfully discarded!');

  // Find the discard button's row (the note row) and the main essay row above it
  const discardBtn = document.querySelector(`button[onclick="discardPulledEssay('${essayId}')"]`);
  if (discardBtn) {
    const noteRow = discardBtn.closest('tr');       // the red note row
    const mainRow = noteRow?.previousElementSibling; // the title row above it
    noteRow?.remove();
    mainRow?.remove();
  }
}

async function editPulledEssay(essayId) {
  const { error } = await sb.rpc('rewrite_essay', { essay_id: essayId });
  if (error) {
    alert('Failed to open essay for editing: ' + error.message);
    return;
  }
  openStudentEssay(essayId, 'rewriting');
}
function prepareAndPrint() {
    const body = document.getElementById('essay-body');
    body.style.height = 'auto'; 
    body.style.height = body.scrollHeight + 'px';
    window.print();
}
async function publishTeacherEssay() {
    const title = document.getElementById('essay-title').value.trim();
    const body = document.getElementById('essay-body').value.trim();

    if (!title || !body) {
        alert("Please provide both a title and content before publishing.");
        return;
    }

    const btn = document.getElementById('btn-publish-teacher');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-squash"></span> PUBLISHING...';

    try {
        const { data: { user }, error: authError } = await sb.auth.getUser();
        if (authError || !user) { alert("Your session has expired. Please log in again."); showPage('reviewer-login'); 
            return;
        }
        const { error } = await sb.from('essays').insert([{
            student_id: user.id,
            title: title,
            body: body,
            status: 'published',
            published_at: new Date().toISOString()
        }]);

        if (error) throw error;

        alert("Your essay is now published in the 📖 READ section.");
        showPage('reviewer-dash');
    } catch (err) {
        console.error(err);
        alert("Error publishing: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🌐 PUBLISH TO WEBSITE';
    }
}

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) { showPage(event.state.page, false); } 
    else { showPage('home', false); } });

function handleEditorKeys(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.substring(0, start) + "    " + e.target.value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 9;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.substring(0, start) + "\n    " + e.target.value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 9;
    }
}
function filterAdminEssays(query) {
  const q = query.toLowerCase();
  
  // Grab all the essay items currently rendered in the admin list
  const essayItems = document.getElementById('admin-essays-published').children;

  for (let i = 0; i < essayItems.length; i++) {
    const item = essayItems[i];
    
    // Skip the "Loading..." text if it's there
    if (item.tagName === 'P') continue; 
    
    // Check if the title inside this item matches the search query
    const title = item.innerText.toLowerCase();
    
    if (title.includes(q)) {
      item.style.display = ''; // Show it
    } else {
      item.style.display = 'none'; // Hide it
    }
  }
}
async function toggleAvailability(isAvailable) {
  if (!currentUser) return;

  // Assuming you have an 'is_available' boolean column in your profiles table
  const { error } = await sb
    .from('profiles')
    .update({ is_available: isAvailable }) 
    .eq('id', currentUser.id); 

  if (error) {
    console.error('Error updating availability:', error);
    
    // Un-check (or re-check) the box visually if the database update fails
    document.getElementById('rev-avail').checked = !isAvailable;
    alert('Failed to save availability status: ' + error.message);
  } else {
    // Optional: You can show a little toast or console log to confirm it worked
    console.log('Reviewer availability set to:', isAvailable);
  }
}
function handleTypingScroll(textarea) {
    if (textarea.scrollTop > 0) {
    const isAtBottom = (textarea.scrollHeight - textarea.scrollTop - textarea.clientHeight) < 150; 
    if (isAtBottom) {
    const btnContainer = document.getElementById('editor-actions');
    const rect = btnContainer.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) { window.scrollBy({ top: rect.bottom - window.innerHeight + 20, behavior: 'smooth' }); 
      }    
    }
  }
}
