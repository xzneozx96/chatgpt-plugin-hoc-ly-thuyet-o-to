async function loadData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return await response.json();
  } catch (error) {
    document.querySelector('#coach').textContent = 'Chưa tải được bộ câu hỏi. Chọn Đặt lại bản mẫu để thử lại.';
    throw error;
  }
}
const [questions, families] = await Promise.all([loadData('/questions.json'), loadData('/families.json')]);
const byId = new Map(questions.map(q => [q.id, q]));
const state = { screen: 'overview', goal: 12, goalChoice: 12, selected: null, confidence: null, assisted: false, confused: false, reviewDone: false, results: [], newIds: new Set(), paused: null, test: null };
const progress = new Map([[144,{covered:true,learned:true,due:false,confusing:false,wrong:false}],[145,{covered:true,learned:false,due:true,confusing:false,wrong:false}],[146,{covered:true,learned:false,due:true,confusing:false,wrong:false}]]);
const categories=[['quy_tac','Quy tắc giao thông'],['diem_liet','Điểm liệt'],['van_hoa','Văn hóa giao thông'],['ky_thuat','Kỹ thuật lái xe'],['cau_tao','Cấu tạo và sửa chữa'],['bien_bao','Biển báo'],['sa_hinh','Sa hình'],['de_nham_lan','Câu hỏi dễ nhầm lẫn']];
const familyIds=g=>g.questionIds.map(id=>Number(id.slice(1)));
const categoryIds=key=>key==='de_nham_lan'?[...new Set(families.flatMap(familyIds))]:questions.filter(q=>q.examCategory===key).map(q=>q.id);
const summary=ids=>{const rows=[...new Set(ids)].map(id=>progress.get(id));return {total:new Set(ids).size,covered:rows.filter(r=>r?.covered).length,learned:rows.filter(r=>r?.learned).length,due:rows.filter(r=>r?.due||r?.confusing).length,confusing:rows.filter(r=>r?.confusing).length,wrong:rows.filter(r=>r?.wrong).length};};
const stats=ids=>{const p=summary(ids);return `<div class="unit-stats"><span><b>${p.covered}/${p.total}</b> Đã thử</span><span><b>${p.learned}/${p.total}</b> Đã nhớ</span><span><b>${p.due}</b> Đến hạn</span><span><b>${p.confusing}</b> Còn phân vân</span></div>`;};
function record(q,key,assisted=false,guessed=false){const previous=progress.get(q.id)||{};if(!previous.covered)state.newIds.add(q.id);const correct=key===q.correctKey;progress.set(q.id,{...previous,covered:true,learned:correct?!!previous.learned:false,due:!correct||guessed||assisted,wrong:!correct,confusing:!!previous.confusing,nextReview:correct?Date.now()+86400000:Date.now()});}
const practice={ids:[],position:0,title:'',returnScreen:'overview'};
const familyStudy = { selected: null, search: '', position: 0, answer: null };
const card = document.querySelector('#card');
const coach = document.querySelector('#coach');
const followup = document.querySelector('#followup');
const userMessage = document.querySelector('#user-message');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label, action, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const actions = (...buttons) => {
  const primary = buttons.find(b => b.includes('class="primary"')) ?? buttons[0];
  const secondary = buttons.filter(b => b !== primary);
  const label = ['review', 'application'].includes(state.screen) ? 'Hỗ trợ hoặc tạm dừng' : 'Tùy chọn khác';
  return `<div class="actions">${primary ?? ''}${secondary.length ? `<details class="more-actions"><summary>${label}</summary><div class="menu-actions">${secondary.join('')}</div></details>` : ''}</div>`;
};
const letters = key => String.fromCharCode(64 + key);
const currentQuestion = () => byId.get(state.screen === 'application' ? 146 : 145);

function show(screen, message) {
  if(state.test&&!state.test.finished&&!['test','confirm-test','exit-test','test-result'].includes(screen)){state.exitTarget=screen;screen='exit-test';}
  state.screen = screen;
  if (message) userMessage.textContent = message;
  render();
  coach.scrollIntoView({block:'start'});
  const heading=card.querySelector('h1, h2');
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}

function startQuestion(screen) {
  state.selected = null;
  state.confidence = null;
  state.assisted = screen === 'application';
  show(screen);
}

function renderQuestion(q, test = false) {
  return `<h2>${escape(q.text)}</h2>${q.imagePath ? `<img class="question-image" src="${escape('/'+q.imagePath)}" alt="Hình minh họa câu ${q.id}">` : ''}<fieldset class="options"><legend class="muted">Chọn một đáp án</legend>${q.options.map(o => `<label class="option"><input type="radio" name="answer" value="${o.key}" ${state.selected === o.key ? 'checked' : ''}><b>${letters(o.key)}</b><span>${escape(o.text)}</span></label>`).join('')}</fieldset>${test ? '' : `<label class="guess-choice"><input type="checkbox" name="guess" ${state.confidence === 'guess' ? 'checked' : ''}> Tôi đang đoán</label>`}`;
}

function questionOptions(q){return renderQuestion(q).replace(`<h2>${escape(q.text)}</h2>`,'');}
function answerFeedback(q,key){return `<div class="answer-line">Bạn chọn <b>${letters(key)} · ${escape(q.options.find(o=>o.key===key).text)}</b></div><div class="answer-line">Đáp án ngân hàng <b>${letters(q.correctKey)} · ${escape(q.options.find(o=>o.key===q.correctKey).text)}</b></div><div class="inline-teaching"><h3>Giải thích từ ngân hàng</h3><p>${q.explanation?escape(q.explanation):'Câu này chưa có giải thích trong nguồn.'}</p><small>Nguồn: ngân hàng câu hỏi · Câu ${q.id}</small></div>`;}
function confusionControl(id){return `<div class="confusion-control">${button(progress.get(id)?.confusing?'Tôi đã rõ câu này':'Tôi còn phân vân',`confusion-${id}`)}<span class="note">${progress.get(id)?.confusing?'Giữ trong phần ôn đến khi bạn tự bỏ dấu.':''}</span></div>`;}
function render() {
  followup.innerHTML = '';
  document.querySelector('#course-nav').innerHTML=button('Khóa học','overview',state.screen==='overview')+button('Ôn tập','review-list',state.screen==='review-list')+button('Thi thử','test-preview',state.screen.startsWith('test'));
  const renderers = {
    overview(){
      coach.textContent='Tôi sẽ giúp bạn ôn câu đến hạn, rồi học tiếp từng phần trong khóa học.';
      const all=summary(questions.map(q=>q.id));
      card.innerHTML=`<div class="intro"><h1>Khóa học của bạn</h1><p>Bằng B · 600 câu gốc · Kế hoạch 60 ngày</p></div><div class="overview"><section class="course"><div class="section-title"><h2>Lộ trình học</h2><span>${all.covered}/600 đã thử · ${all.learned}/600 đã nhớ</span></div><div class="course-list">${categories.map(([key,name],i)=>{const p=summary(categoryIds(key));return `<button class="course-row" data-action="category-${i}"><span class="chapter">${i+1}</span><span class="course-label"><strong>${name}</strong><progress value="${p.covered}" max="${p.total}" aria-label="${name}: ${p.covered} trên ${p.total} câu đã thử"></progress></span><span class="count">${p.covered}/${p.total}<small>${p.due?`${p.due} câu đến hạn`:'Đã thử'}</small></span><svg class="course-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;}).join('')}</div><small class="footnote">Đã thử là lượt trả lời đầu tiên. Đã nhớ cần kiểm tra độc lập cách ngày. Nhóm dễ nhầm lẫn dùng lại các câu gốc, không cộng thêm vào 600 câu.</small></section><aside class="today"><h2>Tiếp nối hôm nay</h2><p>${all.due} câu cần ôn trước bài mới.</p>${button('Tiếp tục hôm nay','daily-start',true)}<div class="today-goal"><span>Mục tiêu câu mới</span><strong>${state.goal} câu / ngày</strong>${button('Đổi mục tiêu','goals')}</div><small>Câu ôn tập tính riêng. Bạn có thể chọn một chủ đề bất cứ lúc nào.</small></aside></div>`;
    },
    'review-list'(){const due=questions.filter(q=>progress.get(q.id)?.due||progress.get(q.id)?.confusing);coach.textContent='Câu sai và câu còn phân vân được giữ trong phần ôn. Trả lời đúng một lần chưa đủ để xác nhận đã nhớ.';card.innerHTML=`<h1>Ôn tập của bạn</h1>${stats(questions.map(q=>q.id))}<div class="course-list">${due.length?due.map(q=>`<button class="course-row" data-action="review-one-${q.id}"><span class="course-label"><strong>Câu ${q.id}</strong><small>${escape(q.text)}</small></span><span class="count">${progress.get(q.id)?.confusing?'Còn phân vân':'Đến hạn'}</span></button>`).join(''):'<p>Chưa còn câu đến hạn trong phiên mẫu này. Hãy tiếp tục chủ đề muốn học.</p>'}</div>${actions(button('Về khóa học','overview',true))}`;},
    'category-detail'(){const [key,name]=categories[state.category];const ids=categoryIds(key);coach.textContent='Mỗi câu có một bản ghi tiến độ. Học ở chủ đề này cũng cập nhật mọi nhóm chứa cùng câu đó.';card.innerHTML=`<h1>${name}</h1>${stats(ids)}<div class="inline-teaching"><h3>Học từng lượt nhỏ</h3><p>Thử 5 câu gốc. Câu đến hạn được ưu tiên, sau đó đến câu chưa thử. Bạn xem giải thích sau mỗi lượt trả lời.</p></div>${actions(button('Học 5 câu trong chủ đề','category-start',true),button('Về khóa học','overview'))}`;},
    'practice-question'(){const q=byId.get(practice.ids[practice.position]);coach.textContent='Đọc đủ điều kiện trong câu hỏi, rồi chọn đáp án của bạn.';card.innerHTML=`<h2>${escape(q.text)}</h2><div class="activity-meta">${escape(practice.title)} · ${practice.position+1}/${practice.ids.length} · Câu ${q.id}</div>${questionOptions(q)}${actions(button('Trả lời','practice-submit',true,state.selected===null),button('Về khóa học','overview'))}`;},
    'practice-feedback'(){const q=byId.get(practice.ids[practice.position]);const r=state.practiceResult;coach.textContent='Tiến độ đã cập nhật trong phiên mẫu. Một câu đúng hôm nay chưa xác nhận nhớ vững.';card.innerHTML=`<h2>${r.correct?'Chính xác':'Chưa đúng'}</h2><div class="activity-meta">${escape(practice.title)} · Câu ${q.id}</div>${answerFeedback(q,r.key)}${confusionControl(q.id)}${actions(button(practice.position+1===practice.ids.length?(practice.returnScreen==='plan'?'Tiếp tục bài học':'Xem tiến độ chủ đề'):'Câu tiếp theo',practice.position+1===practice.ids.length?'practice-complete':'practice-next',true))}`;},
    goals() {
      coach.textContent = 'Chọn số câu mới mỗi ngày. Tôi sẽ hướng dẫn từng bước và ôn câu đến hạn trước bài mới.';
      card.innerHTML = `<div class="activity-meta">Bằng B · Kế hoạch 60 ngày</div><h1>Chọn nhịp học của bạn</h1><fieldset class="goal-options"><legend class="muted">Số câu mới mỗi ngày học</legend>${[10,12,15].map(n => `<label class="goal-choice"><input type="radio" name="daily-goal" value="${n}" ${state.goalChoice===n?'checked':''}><span><b>${n} câu / ngày</b>${n===12?' <span class="tag">Đề xuất</span>':''}<small>${Math.ceil(600/n)} ngày học · ${60-Math.ceil(600/n)} ngày linh hoạt</small></span></label>`).join('')}<label class="goal-choice"><input type="radio" name="daily-goal" value="custom" ${state.goalChoice==='custom'?'checked':''}><span><b>Tự chọn số câu</b><small>Đặt nhịp học riêng của bạn</small></span></label></fieldset>${state.goalChoice==='custom'?`<label for="custom-goal">Số câu mới mỗi ngày</label><div class="custom-form"><input id="custom-goal" type="number" min="1" max="600" step="1" value="${state.goal}"></div><p id="goal-forecast" class="note"></p>`:''}<p class="note">Câu ôn tập tính riêng. Bạn có thể đổi mục tiêu sau.</p>${actions(button('Tiếp tục','confirm-goal',true,state.goalChoice===null))}`;
    },
    custom() {
      coach.textContent = 'Bạn có thể đổi mục tiêu bất cứ lúc nào. Nếu nhịp học không phù hợp với 60 ngày, tôi sẽ cho biết dự kiến mới.';
      card.innerHTML = `<div class="activity-meta">Mục tiêu của bạn</div><h1>Chọn nhịp học riêng</h1><label for="custom-goal">Số câu mới mỗi ngày học</label><div class="custom-form"><input id="custom-goal" type="number" min="1" max="600" step="1" value="${state.goal}">${button('Chọn mục tiêu', 'save-goal', true)}</div><div id="goal-forecast" class="note"></div>${actions(button('Xem các gợi ý', 'goals'))}`;
      updateForecast();
    },
    plan() {
      coach.textContent = 'Ta học một cặp câu về tốc độ: thử nhớ lại, làm rõ điều kiện khác nhau, rồi áp dụng.';
      card.innerHTML = `<div class="activity-meta">Buổi học hôm nay</div><h1>Phân biệt điều kiện tốc độ</h1><p>${'Bài hướng dẫn mẫu: thử nhớ lại một câu tốc độ, đối chiếu điều kiện, rồi áp dụng ở câu liên quan.'}</p><p class="note">Mục tiêu ${state.goal} câu mới/ngày. Thời gian mẫu: ôn khoảng 3 phút, bài mới khoảng 15–20 phút.</p>${actions(button(state.reviewDone?'Tiếp tục bài học':'Bắt đầu học',state.reviewDone?'comparison':'review',true),button('Đổi mục tiêu','goals'),button('Chọn chủ đề','categories'),button('Thi thử','test-preview'))}<details class="progress-details"><summary>Xem tiến độ</summary><p>Câu mới đã thử hôm nay ${state.newIds.size}/${state.goal} · Đã thử lượt đầu ${summary(questions.map(q=>q.id)).covered}/600 · Đã nhớ qua kiểm tra cách ngày ${summary(questions.map(q=>q.id)).learned}/600.</p><p>Bài hướng dẫn mẫu có một lượt nhớ lại và một câu áp dụng. Tiến độ chỉ thuộc phiên mẫu. Lượt hướng dẫn chỉ có hai câu, chưa hoàn thành mục tiêu ngày.</p></details>`;
    },
    review: () => questionScreen('Ôn tập đến hạn · Câu 1/1', 'Hãy thử trả lời trước khi xem giải thích. Bạn có thể hỏi nếu cần giúp đỡ.'),
    application: () => questionScreen('Áp dụng · Điều kiện khác', 'Giữ nguyên nhóm phương tiện, nhưng chú ý loại đường. Hãy thử câu gốc còn lại trong ngân hàng.'),
    feedback() {
      const result = state.results.at(-1);
      const q = byId.get(result.id);
      const title = !result.correct ? 'Chưa đúng' : result.assisted ? 'Đúng sau hỗ trợ' : result.guessed ? 'Đúng · Bạn đang đoán' : 'Chính xác';
      coach.textContent = result.correct ? 'Ta xem lại điểm khác nhau giữa hai câu trước khi kết luận đã nhớ vững nhé.' : 'Ta kiểm tra cụm mô tả loại đường. Đây là điều kiện thay đổi giữa hai câu, dù nhóm phương tiện giống nhau.';
      card.innerHTML = `<div class="activity-meta">${result.phase === 'review' ? 'Ôn tập' : 'Áp dụng'} · Câu ${q.id}</div><div class="verdict ${!result.correct ? 'wrong' : result.assisted || result.guessed ? 'uncertain' : ''}"><strong>${title}</strong><p>${result.phase === 'review' ? 'Đã ghi nhận lượt ôn mẫu' : 'Đã ghi nhận lượt áp dụng mẫu'}. Chưa xác nhận nhớ vững từ lượt này.</p></div>${answerFeedback(q,result.key)}<p class="note">Kết quả chỉ nằm trong bộ nhớ bản mẫu. Câu đúng được hẹn ôn vào ngày mai trong bản mẫu; câu sai hoặc còn phân vân vẫn ở phần ôn.</p>${result.phase === 'review' ? `<div class="inline-teaching"><h3>Điều cần nhớ</h3><p>Xe mô tô hai bánh và ô tô chở người đến 28 chỗ, không kể người lái, trong khu đông dân cư. Đáp án thay đổi theo loại đường:</p><div class="distinction"><span>Đường đôi / một chiều từ 2 làn xe cơ giới</span><b>60 km/h</b></div><div class="distinction"><span>Đường hai chiều / một chiều 1 làn xe cơ giới, trừ cao tốc</span><b>50 km/h</b></div><small>Đối chiếu câu 145 và 146 trong ngân hàng. Câu tiếp theo là áp dụng sau hỗ trợ.</small></div>` : ''}${state.confused ? '<span class="badge">Bạn còn phân vân · giữ trong kế hoạch ôn</span>' : ''}${actions(button(result.phase === 'review' ? 'Thử câu liên quan' : 'Xem tổng kết',result.phase === 'review' ? 'application' : 'recap',true),button('Tôi còn phân vân','flag'),button('Xem nguồn','source'))}`;
    },
    comparison() {
      coach.textContent = 'Hai câu cùng nói đến khu vực đông dân cư và cùng nhóm phương tiện. Hãy đặt điều kiện loại đường cạnh nhau để thấy đáp án thay đổi ở đâu.';
      card.innerHTML = `<div class="activity-meta">Câu hỏi dễ nhầm lẫn · q145 / q146</div><h1>Cùng nhóm xe. Khác loại đường.</h1><p>Xe mô tô hai bánh và ô tô chở người đến 28 chỗ, không kể chỗ người lái xe. Cả hai câu đều nói về khu vực đông dân cư.</p><div class="compare"><div><small>CÂU 145</small><p>Đường đôi hoặc đường một chiều có từ hai làn xe cơ giới trở lên</p><strong>60 km/h</strong></div><div><small>CÂU 146 · TRỪ CAO TỐC</small><p>Đường hai chiều hoặc đường một chiều có một làn xe cơ giới</p><strong>50 km/h</strong></div></div><span class="source-label">Đối chiếu điều kiện và đáp án trong ngân hàng</span><p class="note">Nội dung minh hoạ lấy từ câu gốc. Phần giảng và nhóm so sánh vẫn cần duyệt biên tập trước khi phát hành.</p>${actions(button('Thử câu có điều kiện khác','application',true),button('Xem nguồn / video','source'),button('Tạm dừng','pause'))}`;
    },
    source() {
      coach.textContent = 'Nguồn đang có trong bản mẫu là ngân hàng câu hỏi bạn cung cấp. Chưa có đoạn video được xác minh cho cặp câu này.';
      card.innerHTML = `<div class="activity-meta">Nguồn giải thích</div><h1>Giữ đúng điều kiện của câu hỏi</h1><p>Ngân hàng câu hỏi bạn cung cấp</p><p class="muted">Đối chiếu câu 145 và 146, loại đường, phạm vi khu đông dân cư, nhóm xe và đáp án riêng của từng câu.</p><div class="toast">Chưa có liên kết YouTube với mốc thời gian đã xác minh. Khi nguồn được kết nối, bạn sẽ mở đoạn video bên ngoài và tiếp tục tại câu đang học.</div>${actions(button('Quay lại học','back-source',true))}`;
    },
    recap() {
      coach.textContent = 'Bạn đã đi qua một lượt nhớ lại và một câu có điều kiện khác. Lần kiểm tra cách ngày sau sẽ giúp xác định điều gì còn cần ôn.';
      card.innerHTML = `<div class="activity-meta">Tổng kết buổi mẫu</div><h1>Một điều kiện dễ lẫn đã được đối chiếu</h1><p>Trong khu đông dân cư, hãy đọc đủ cụm mô tả loại đường và nhóm phương tiện trước khi chọn tốc độ.</p><div class="summary-row"><span>Câu ôn mẫu đã thử</span><b>${state.reviewDone ? 1 : 0}/1</b></div><div class="summary-row"><span>Câu mới đã thử hôm nay</span><b>${state.newIds.size}/${state.goal}</b></div><div class="summary-row"><span>Lượt trả lời đúng</span><b>${state.results.filter(r=>r.correct).length}/${state.results.length}</b></div><div class="summary-row"><span>Còn phân vân</span><b>${state.confused ? 'Có' : 'Chưa đánh dấu'}</b></div><p class="note">Đã thử lượt đầu ${summary(questions.map(q=>q.id)).covered}/600. Tiến độ mẫu không đồng nghĩa với tất cả đã nhớ vững. Câu mới còn cần kiểm tra cách ngày; hôm nay chưa hoàn thành mục tiêu ${state.goal} câu.</p>${actions(button('Kết thúc buổi học','done',true),...(state.confused ? [button('Tôi đã rõ chỗ khác nhau','clear-flag')] : []),button('Về kế hoạch','plan'))}`;
    },
    done() {
      coach.textContent = 'Buổi mẫu đã kết thúc. Lần quay lại, tôi sẽ ưu tiên câu đến hạn rồi tiếp tục bài mới.';
      card.innerHTML = `<div class="activity-meta">Đã kết thúc buổi mẫu</div><h1>Hẹn bạn ở buổi học tiếp theo</h1><p>Đã thử ${state.reviewDone?1:0} câu ôn và một câu áp dụng liên quan. Mục tiêu hôm nay ${state.newIds.size}/${state.goal}.</p><p class="note">Câu mới vẫn cần kiểm tra cách ngày. Bản mẫu không lưu tiến độ sau khi tải lại.</p>${actions(button('Về kế hoạch học','plan',true),button('Thi thử','test-preview'),button('Đổi mục tiêu','goals'))}`;
    },
    categories() {
      coach.textContent = 'Bài học đi theo các nhóm trong ngân hàng. Nhóm dễ nhầm lẫn giúp so sánh câu liên quan và dùng chung tiến độ của từng câu.';
      const names=['Quy tắc giao thông','Điểm liệt','Văn hóa giao thông','Kỹ thuật lái xe','Cấu tạo và sửa chữa','Biển báo','Sa hình','Câu hỏi dễ nhầm lẫn'];
      card.innerHTML = `<div class="activity-meta">Chọn chủ đề</div><h1>Bạn muốn làm rõ điều gì?</h1><div class="category-grid">${names.map((n,i)=>button(n,`category-${i}`)).join('')}</div><p id="category-detail" class="categories-note">Bản mẫu có bài so sánh tốc độ. Các nhóm khác chỉ minh hoạ cách khám phá.</p>${actions(button('Học cặp câu về tốc độ','comparison',true),button('Về kế hoạch','plan'))}`;
    },
    families() {
      coach.textContent = 'Chọn một nhóm để đối chiếu các câu có điều kiện hoặc đáp án dễ lẫn. Tiến độ câu cập nhật trong phiên mẫu ở mọi nhóm liên quan.';
      card.innerHTML = `<div class="activity-meta">Chủ đề · Câu hỏi dễ nhầm lẫn</div><h1>Chọn nhóm muốn làm rõ</h1><label for="family-search">Tìm theo tên nhóm hoặc số câu</label><input id="family-search" type="search" class="family-search" placeholder="Ví dụ: tốc độ, tuổi, biển cấm, q145" value="${escape(familyStudy.search)}"><p id="family-count" class="note" aria-live="polite"></p><fieldset class="family-list"><legend class="muted">Chọn một nhóm câu hỏi</legend><div id="family-options"></div></fieldset><p class="note">249 nhóm từ phân tích ngân hàng, có câu thuộc nhiều nhóm. Nhóm và nội dung so sánh chưa được duyệt biên tập.</p>${actions(button('Tiếp tục','family-detail',true,!familyStudy.selected),button('Về các chủ đề','categories'))}`;
      filterFamilies();
    },
    'family-detail'() {
      const g=families.find(g=>g.id===familyStudy.selected);
      coach.textContent = 'Ta giữ nguyên câu hỏi và đáp án trong ngân hàng. Khi triển khai, ChatGPT sẽ xây bài học từ nguồn đã duyệt và lịch sử của bạn trong nhóm này.';
      card.innerHTML=`<h1>${escape(g.title)}</h1>${stats(familyIds(g))}<div class="inline-teaching"><h3>Những điểm cần đối chiếu</h3><ul>${g.comparisonAxes.map(a=>`<li>${escape(a)}</li>`).join('')}</ul><small>Trục so sánh từ phân tích dự thảo, chưa phải bài giảng đã duyệt.</small></div><details class="progress-details"><summary>Xem các câu trong nhóm</summary>${g.questionIds.map(id=>{const q=byId.get(Number(id.slice(1)));return `<p><b>Câu ${q.id}</b> · ${escape(q.text)}</p>`;}).join('')}</details>${g.requiresVisualReview?'<p class="note">Nhóm có hình ảnh cần duyệt trực quan trước khi phát hành bài giảng.</p>':''}<p class="note">Tiến độ cập nhật trong phiên mẫu và dùng chung ở mọi nhóm chứa câu này. Tải lại sẽ đặt lại dữ liệu.</p>${actions(button('Thử câu trong nhóm','family-start',true),button('Đổi nhóm','families'),button('Về các chủ đề','categories'))}`;
    },
    'family-question'() {
      const g=families.find(g=>g.id===familyStudy.selected);
      const q=byId.get(Number(g.questionIds[familyStudy.position].slice(1)));
      coach.textContent='Hãy thử trả lời trước. Sau đó xem đáp án và giải thích gốc, nếu ngân hàng có cung cấp.';
      card.innerHTML=`<div class="activity-meta">${escape(g.title)} · ${familyStudy.position+1}/${g.questionIds.length}</div>${renderQuestion(q)}${actions(button('Trả lời','family-submit',true,state.selected===null),button('Đổi nhóm','families'),button('Xem lại nhóm','family-detail'))}`;
    },
    'family-feedback'() {
      const g=families.find(g=>g.id===familyStudy.selected);
      const q=byId.get(Number(g.questionIds[familyStudy.position].slice(1)));
      const correct=familyStudy.answer===q.correctKey;
      const last=familyStudy.position===g.questionIds.length-1;
      coach.textContent='Đối chiếu lời giải với điều kiện trong câu gốc. Tiến độ câu này dùng chung giữa các chủ đề và nhóm liên quan.';
      card.innerHTML=`<div class="activity-meta">${escape(g.title)} · Câu ${q.id}</div><h2>${escape(q.text)}</h2><div class="verdict ${correct?'':'wrong'}"><strong>${correct?'Chính xác':'Chưa đúng'}</strong></div><div class="answer-line">Bạn chọn <b>${letters(familyStudy.answer)} · ${escape(q.options.find(o=>o.key===familyStudy.answer).text)}</b></div><div class="answer-line">Đáp án ngân hàng <b>${letters(q.correctKey)} · ${escape(q.options.find(o=>o.key===q.correctKey).text)}</b></div><div class="inline-teaching"><h3>Giải thích từ ngân hàng</h3><p>${q.explanation?escape(q.explanation):'Câu này chưa có giải thích trong nguồn. Bản mẫu không tự bổ sung lời giải.'}</p><small>Nguồn: question-bank.json · Câu ${q.id}. Chưa có nguồn video xác minh trong bản mẫu.</small></div><p class="note">Đã thử ${familyStudy.position+1}/${g.questionIds.length} câu trong lượt mẫu. Chưa xác nhận nhớ vững. Tiến độ chỉ nằm trong phiên mẫu.</p>${confusionControl(q.id)}${actions(button(last?'Kết thúc lượt thử':'Câu tiếp theo',last?'family-complete':'family-next',true),button('Đổi nhóm','families'))}`;
    },
    paused() {
      coach.textContent = 'Ta có thể dừng ở đây. Bạn sẽ quay lại đúng bước đang học trong phiên mẫu này.';
      card.innerHTML = `<div class="activity-meta">Tạm dừng</div><h1>Giữ lại bước đang học</h1><p>Câu trả lời và mục tiêu mẫu vẫn còn trong phiên này. Tải lại trang sẽ đặt lại chúng.</p>${actions(button('Tiếp tục học','resume',true),button('Về kế hoạch','plan'))}`;
    },
    'test-preview'() {
      coach.textContent = 'Bài ngẫu nhiên lấy từ toàn bộ ngân hàng bằng B, chưa mô phỏng phân bố đề thi chính thức. Thi thử có nhịp riêng. Bạn tự chọn đáp án và chỉ xem kết quả khi nộp bài hoặc hết giờ.';
      card.innerHTML = `<div class="activity-meta">Thi thử · Bài luyện ngẫu nhiên</div><h1>30 câu · 20 phút</h1><div class="summary-row"><span>Mức điểm đạt</span><b>27/30 trở lên</b></div><div class="summary-row"><span>Điểm liệt</span><b>Sai một câu là không đạt</b></div><p class="note">Bản mẫu dùng 30 câu gốc. Thành phần đề ngẫu nhiên không được xác nhận là phân bố đề thi chính thức. Không có gợi ý hoặc kết quả khi đang làm.</p>${summary(questions.map(q=>q.id)).due ? `<p class="note">Bạn còn ${summary(questions.map(q=>q.id)).due} câu cần ôn. Thi thử trước sẽ giữ nguyên phần ôn.</p>` : ''}${actions(button('Bắt đầu tính giờ','start-test',true),button('Đề từ thư viện','library'),button('Về kế hoạch','plan'))}`;
    },
    library() {
      coach.textContent = 'Thư viện đề do chủ sản phẩm cung cấp chưa có. Tôi không thay đề thư viện bằng một đề khác mà không báo.';
      card.innerHTML = `<h1>Chưa có thư viện đề</h1><p>Bạn có thể thử giao diện đề ngẫu nhiên từ ngân hàng.</p>${actions(button('Xem đề ngẫu nhiên','test-preview',true),button('Về kế hoạch','plan'))}`;
    },
    test: renderTest,
    'confirm-test'() {
      coach.textContent = 'Kiểm tra số câu chưa trả lời trước khi nộp. Bạn có thể quay lại làm tiếp khi còn thời gian.';
      card.innerHTML = `<h1>Nộp bài thi thử?</h1><p>Còn ${30-state.test.answers.size} câu chưa trả lời. Câu bỏ trống được tính sai khi chấm đề.</p>${actions(button('Nộp bài','finish-test',true),button('Quay lại làm tiếp','test'))}`;
    },
    'exit-test'() {
      coach.textContent = 'Để nhận giải thích, bạn cần kết thúc lượt thi độc lập. Lượt đang làm sẽ được ghi là đã dừng, không có kết quả đạt.';
      card.innerHTML = `<h1>Dừng thi để học?</h1><p>Các lựa chọn chưa nộp không trở thành kết quả học. Đồng hồ vẫn chạy cho tới khi bạn xác nhận dừng.</p>${actions(button('Dừng thi và học','abandon-test',true),button('Tiếp tục thi','test'))}`;
    },
    'test-abandoned'() {
      coach.textContent = 'Lượt thi mẫu đã dừng. Các đáp án tạm không trở thành kết quả học.';
      card.innerHTML = `<h1>Đã dừng lượt thi</h1><p>Giải thích cho từng câu thi chưa có trong bản mẫu này. Bạn có thể duyệt bài so sánh tốc độ mẫu hoặc quay lại kế hoạch.</p>${actions(button('Xem bài học mẫu','comparison',true),button('Về kế hoạch','plan'))}`;
    },
    'test-result'() {
      const t=state.test;
      const correct=t.ids.filter(id=>t.answers.get(id)===byId.get(id).correctKey).length;
      const criticalFailure=t.ids.some(id=>byId.get(id).isCritical && t.answers.get(id)!==byId.get(id).correctKey);
      const passed=correct>=27 && !criticalFailure;
      coach.textContent='Kết quả thi và kế hoạch học có vai trò khác nhau. Ta tách câu trả lời sai khỏi câu còn bỏ trống để biết bước ôn tiếp theo.';
      card.innerHTML=`<div class="activity-meta">Kết quả thi thử mẫu</div><h1>${correct}/30 · ${passed ? 'Đạt theo cấu hình' : 'Chưa đạt'}</h1><div class="verdict ${passed?'':'wrong'}"><strong>${criticalFailure ? 'Có câu điểm liệt sai hoặc bỏ trống' : passed ? 'Đủ điểm và không sai điểm liệt' : 'Chưa đạt mức 27 câu đúng'}</strong></div><div class="summary-row"><span>Câu đã trả lời sai</span><b>${t.answers.size-correct}</b></div><div class="summary-row"><span>Câu bỏ trống</span><b>${30-t.answers.size}</b></div><p class="note">Bản mẫu không cập nhật lịch ôn hay tiến độ sản xuất. Khi triển khai, câu sai cần học lại; câu bỏ trống là khoảng trống cần học, không phải lỗi đã trả lời.</p>${actions(button('Về kế hoạch học','plan',true),button('Làm một đề khác','test-preview'))}`;
    }
  };
  renderers[state.screen]();
  const metadata=card.querySelector(':scope > .activity-meta');
  const heading=card.querySelector(':scope > h1, :scope > h2');
  if(metadata && heading)heading.after(metadata);
  if(document.querySelector('#custom-goal'))updateForecast();
  const phases = {review:0, feedback:state.results.at(-1)?.phase==='review'?1:2, comparison:1, application:2, recap:3};
  const phase=phases[state.screen];
  if(phase!==undefined){const strip=document.createElement('div');strip.className='session-path';strip.setAttribute('aria-label','Tiến trình buổi học');strip.innerHTML=['Ôn lại','Hiểu','Áp dụng','Tổng kết'].map((name,i)=>`<span class="${i===phase?'current-phase':''}">${name}</span>`).join('<span class="path-divider">›</span>');card.prepend(strip);}

}

function questionScreen(label, text) {
  const q=currentQuestion();
  coach.textContent=text;
  card.innerHTML=`<div class="activity-meta">${label} · Câu ${q.id}</div>${renderQuestion(q)}${state.assisted?'<div class="toast">Đã nhận hỗ trợ · Lượt này không xác nhận nhớ độc lập.</div>':''}${state.confused?'<span class="badge">Đã đánh dấu còn phân vân</span>':''}${actions(button('Trả lời','submit',true,state.selected===null),button('Tôi còn phân vân','flag'),button('Gợi ý','hint'),button('Tạm dừng','pause'))}`;
}

function filterFamilies() {
  const normalize=t=>t.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  const query=normalize(familyStudy.search.trim());
  const number=query.match(/^(?:q|cau\s*)?(\d+)$/);
  const matches=families.filter(g=>number?g.questionIds.includes(`q${number[1].padStart(3,'0')}`):normalize(g.title).includes(query));
  document.querySelector('#family-count').textContent=`${matches.length} / ${families.length} nhóm${familyStudy.selected?' · Đã chọn: '+families.find(g=>g.id===familyStudy.selected).title:''}`;
  document.querySelector('#family-options').innerHTML=matches.length?matches.map(g=>`<label class="goal-choice"><input type="radio" name="family" value="${escape(g.id)}" ${familyStudy.selected===g.id?'checked':''}><span><b>${escape(g.title)}</b><small>${g.questionIds.length} câu gốc${g.requiresVisualReview?' · Có hình minh họa':''}</small></span></label>`).join(''):'<p class="note">Không tìm thấy nhóm. Thử từ khóa khác hoặc xóa ô tìm kiếm.</p>';
}

function updateForecast() {
  const n=Number(document.querySelector('#custom-goal')?.value);
  const output=document.querySelector('#goal-forecast');
  if (!output) return;
  output.textContent=Number.isInteger(n)&&n>=1&&n<=600 ? `${Math.ceil(600/n)} ngày học để đi hết 600 câu từ đầu. ${Math.ceil(600/n)>60?'Nhịp này cần lâu hơn 60 ngày.':`Còn ${60-Math.ceil(600/n)} ngày trong kế hoạch 60 ngày.`} Với tiến độ mẫu hiện tại, còn ${600-summary(questions.map(q=>q.id)).covered} câu.` : 'Nhập một số nguyên từ 1 đến 600.';
}

function renderTest() {
  const t=state.test;
  state.selected=t.answers.get(t.ids[t.position])??null;
  coach.textContent='Bạn có thể quay lại câu trước. Lựa chọn chỉ là đáp án tạm thời cho tới lúc nộp bài.';
  card.innerHTML=`<div class="test-top"><div class="activity-meta">Thi thử · Câu ${t.position+1}/30</div><span id="timer" class="timer"></span></div>${renderQuestion(byId.get(t.ids[t.position]),true)}<details class="test-index"><summary>Danh sách câu · ${t.answers.size}/30 đã chọn</summary><div class="navigator" aria-label="Chuyển câu thi">${t.ids.map((id,i)=>`<button data-action="test-nav-${i}" class="${t.answers.has(id)?'answered':''} ${i===t.position?'active':''}" aria-label="Câu ${i+1}${t.answers.has(id)?', đã chọn đáp án':''}">${i+1}</button>`).join('')}</div></details><p class="note">Đáp án đang lưu tạm trong phiên mẫu.</p><div class="actions test-buttons">${button('Câu trước','test-prev',false,t.position===0)}${button(t.position===29?'Xem lại và nộp':'Câu tiếp theo',t.position===29?'confirm-test':'test-next',true)}<details class="more-actions"><summary>Tùy chọn bài thi</summary><div class="menu-actions">${button('Nộp bài','confirm-test')}${button('Tôi cần giải thích','exit-test')}</div></details></div>`;
  updateTimer();
}

function updateTimer() {
  if (!state.test || state.test.finished) return;
  const seconds=Math.max(0,Math.ceil((state.test.deadline-Date.now())/1000));
  const timer=document.querySelector('#timer');
  if(timer)timer.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(seconds===0){state.test.finished=true;show('test-result');}
}
setInterval(updateTimer,1000);

document.addEventListener('change',e=>{
  if(e.target.name==='family'){familyStudy.selected=e.target.value;document.querySelector('#family-count').textContent=`Đã chọn: ${families.find(g=>g.id===familyStudy.selected).title}`;document.querySelector('[data-action="family-detail"]').disabled=false;return;}
  if(e.target.name==='daily-goal'){state.goalChoice=e.target.value==='custom'?'custom':Number(e.target.value);render();document.querySelector('input[name="daily-goal"]:checked')?.focus();return;}
  if(e.target.name==='guess'){state.confidence=e.target.checked?'guess':null;return;}
  if(e.target.name!=='answer')return;
  state.selected=Number(e.target.value);
  if(state.screen==='test'){
    if(Date.now()>=state.test.deadline){updateTimer();return;}
    state.test.answers.set(state.test.ids[state.test.position],state.selected);
    render();
  } else {render();document.querySelector('input[name="answer"]:checked')?.focus();}
});
document.addEventListener('input',e=>{if(e.target.id==='custom-goal')updateForecast();if(e.target.id==='family-search'){familyStudy.search=e.target.value;filterFamilies();}});
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(state.test && !state.test.finished && ['test','confirm-test','exit-test'].includes(state.screen) && Date.now()>=state.test.deadline){updateTimer();return;}
  if(action==='daily-start'){const ids=questions.filter(q=>progress.get(q.id)?.due||progress.get(q.id)?.confusing).map(q=>q.id);if(ids.length){practice.ids=ids;practice.position=0;practice.title='Ôn tập hôm nay';practice.returnScreen='plan';state.selected=null;state.confidence=null;show('practice-question');}else show('plan');}
  else if(action==='confirm-goal'){if(state.goalChoice===null)return;const value=state.goalChoice==='custom'?Number(document.querySelector('#custom-goal').value):state.goalChoice;if(!Number.isInteger(value)||value<1||value>600){document.querySelector('#custom-goal')?.focus();return;}state.goal=value;show('overview',`Tôi chọn ${state.goal} câu mới mỗi ngày.`);}
  else if(action==='save-goal'){
    const value=Number(document.querySelector('#custom-goal').value);
    if(!Number.isInteger(value)||value<1||value>600){document.querySelector('#custom-goal').focus();return;}
    state.goal=value;state.goalChoice='custom';show('overview',`Mục tiêu của tôi là ${value} câu mới/ngày.`);
  }
  else if(action==='review'||action==='application')startQuestion(action);
  else if(action==='submit'){
    if(state.selected===null)return;
    const q=currentQuestion();const phase=state.screen;record(q,state.selected,state.assisted,state.confidence==='guess');
    state.results.push({id:q.id,key:state.selected,correct:state.selected===q.correctKey,assisted:state.assisted,guessed:state.confidence==='guess',phase});
    if(phase==='review')state.reviewDone=true;
    show('feedback');
  }
  else if(action.startsWith('confidence-')){state.confidence=action.slice(11);render();}
  else if(action==='flag'){state.confused=true;const id=state.screen==='feedback'?state.results.at(-1).id:currentQuestion().id;progress.set(id,{...progress.get(id),confusing:true});render();followup.innerHTML='<p>Đã ghi nhận bạn còn phân vân trong phiên mẫu. Trả lời đúng sẽ không tự xoá dấu này.</p>';}
  else if(action==='clear-flag'){state.confused=false;for(const id of [145,146])progress.set(id,{...progress.get(id),confusing:false});render();followup.innerHTML='<p>Đã bỏ dấu phân vân theo xác nhận của bạn. Kết quả và lịch ôn không bị xoá.</p>';}
  else if(action==='hint'){state.assisted=true;render();followup.innerHTML='<p>Hãy đọc cụm mô tả loại đường: đường đôi, đường một chiều có từ hai làn, hay đường hai chiều? Đây là điểm cần đối chiếu giữa hai câu.</p>';}
  else if(action==='source'){state.sourceReturn=state.screen;show('source');}
  else if(action==='back-source')show(state.sourceReturn??'comparison');
  else if(action==='pause'){state.paused=state.screen;show('paused');}
  else if(action==='resume')show(state.paused??'plan');
  else if(action==='category-7')show('families');
  else if(action==='family-start'){familyStudy.position=0;state.selected=null;state.confidence=null;show('family-question');}
  else if(action==='family-submit'){if(state.selected===null)return;familyStudy.answer=state.selected;const g=families.find(g=>g.id===familyStudy.selected);record(byId.get(Number(g.questionIds[familyStudy.position].slice(1))),state.selected,false,state.confidence==='guess');show('family-feedback');}
  else if(action==='family-next'){familyStudy.position++;state.selected=null;state.confidence=null;show('family-question');}
  else if(action==='family-complete')show('family-detail');
  else if(action==='category-start'){const ids=categoryIds(categories[state.category][0]);const rank=id=>progress.get(id)?.due||progress.get(id)?.confusing?0:progress.get(id)?.covered?2:1;practice.ids=[...ids].sort((a,b)=>rank(a)-rank(b)).slice(0,5);practice.position=0;practice.title=categories[state.category][1];practice.returnScreen='category-detail';state.selected=null;state.confidence=null;show('practice-question');}
  else if(action.startsWith('category-')){state.category=Number(action.slice(9));show('category-detail');}
  else if(action.startsWith('review-one-')){practice.ids=[Number(action.slice(11))];practice.position=0;practice.title='Ôn tập đến hạn';practice.returnScreen='review-list';state.selected=null;state.confidence=null;show('practice-question');}
  else if(action==='practice-submit'){if(state.selected===null)return;const q=byId.get(practice.ids[practice.position]);record(q,state.selected,false,state.confidence==='guess');state.practiceResult={key:state.selected,correct:state.selected===q.correctKey};show('practice-feedback');}
  else if(action==='practice-next'){practice.position++;state.selected=null;state.confidence=null;show('practice-question');}
  else if(action==='practice-complete')show(practice.returnScreen);
  else if(action.startsWith('confusion-')){const id=Number(action.slice(10));const previous=progress.get(id)||{};progress.set(id,{...previous,confusing:!previous.confusing});render();}
  else if(action==='start-test'){
    const ids=questions.filter(q=>q.applicableLicenses?.includes('B')).map(q=>q.id);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    state.test={ids:ids.slice(0,30),position:0,answers:new Map(),deadline:Date.now()+20*60*1000,finished:false};show('test');
  }
  else if(action.startsWith('test-nav-')){state.test.position=Number(action.slice(9));show('test');}
  else if(action==='test-prev'){state.test.position=Math.max(0,state.test.position-1);show('test');}
  else if(action==='test-next'){state.test.position=Math.min(29,state.test.position+1);show('test');}
  else if(action==='finish-test'){state.test.finished=true;show('test-result');}
  else if(action==='abandon-test'){state.test.finished=true;show(state.exitTarget??'test-abandoned');state.exitTarget=null;}
  else show(action==='categories'||action==='plan'?'overview':action);
});

document.querySelector('#reset').onclick=()=>location.reload();
document.querySelector('#composer').onsubmit=e=>{
  e.preventDefault();const input=document.querySelector('#message');const text=input.value.trim();if(!text)return;input.value='';userMessage.textContent=text;
  if(state.test&&!state.test.finished){show('exit-test');return;}
  const normalized=text.toLocaleLowerCase('vi');const match=normalized.match(/(\d+)\s*câu/);
  if(match&&Number(match[1])>=1&&Number(match[1])<=600){state.goal=Number(match[1]);state.goalChoice=[10,12,15].includes(state.goal)?state.goal:'custom';show('overview');}
  else if(/thi|(?:^|\s)đề(?:\s|$)/.test(normalized)&&!normalized.includes('chủ đề'))show('test-preview');
  else if(/mục tiêu/.test(normalized))show('goals');
  else if(/nhầm/.test(normalized))show('families');
  else if(/chủ đề|biển báo/.test(normalized))show('categories');
  else if(/dừng/.test(normalized)){state.paused=state.screen;show('paused');}
  else if(/tiếp|hôm nay/.test(normalized))show(state.screen==='paused'?state.paused:'plan');
  else if(/video|nguồn/.test(normalized)){state.sourceReturn=state.screen;show('source');}
  else followup.innerHTML='<p>Bản mẫu không gọi mô hình ChatGPT. Bạn có thể nhập “10 câu mỗi ngày”, “thi thử”, “tạm dừng” hoặc “tiếp tục”.</p>';
};
render();
