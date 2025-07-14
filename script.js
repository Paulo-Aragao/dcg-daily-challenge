class DigimonTermoGame {
    constructor() {
        this.allCards = [];
        this.targetCard = null;
        this.attempts = [];
        this.gameWon = false;
        this.correctAttributes = new Set();
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadAllCards();
            this.selectDailyCard();
            await this.loadTargetCard();
            this.setupEventListeners();
            this.showGame();
        } catch (error) {
            this.showError('Erro ao carregar o jogo. Tente novamente.');
            console.error('Erro na inicialização:', error);
        }
    }
    
    async loadAllCards() {
        try {
            const response = await fetch('https://digimoncard.io/api-public/getAllCards.php?sort=name&series=Digimon Card Game&sortdirection=asc');
            if (!response.ok) throw new Error('Erro ao carregar cartas');
            this.allCards = await response.json();
        } catch (error) {
            throw new Error('Não foi possível carregar as cartas');
        }
    }
    
    selectDailyCard() {
        const today = new Date().toDateString();
        const seed = this.hashCode(today);
        const randomIndex = Math.abs(seed) % this.allCards.length;
        this.dailyCardId = this.allCards[randomIndex].cardnumber;
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
    
    async loadTargetCard() {
        try {
            const response = await fetch(`https://digimoncard.io/api-public/search.php?card=${this.dailyCardId}`);
            if (!response.ok) throw new Error('Erro ao carregar carta alvo');
            const data = await response.json();
            this.targetCard = data[0];
            this.setupMysteryCard();
        } catch (error) {
            throw new Error('Não foi possível carregar a carta do dia');
        }
    }
    
    setupMysteryCard() {
        const mysteryImg = document.getElementById('mysteryImg');
        mysteryImg.src = `https://images.digimoncard.io/images/cards/${this.targetCard.id}.jpg`;
    }
    
    setupEventListeners() {
        const searchBox = document.getElementById('searchBox');
        const suggestions = document.getElementById('suggestions');
        
        searchBox.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        searchBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const firstSuggestion = suggestions.querySelector('.suggestion-item');
                if (firstSuggestion) {
                    const cardId = firstSuggestion.dataset.cardId;
                    this.selectCard(cardId);
                }
            }
        });
        
        // Fechar sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchBox.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });
    }
    
    handleSearch(query) {
        const suggestions = document.getElementById('suggestions');
        
        if (query.length < 2) {
            suggestions.style.display = 'none';
            return;
        }
        
        const filtered = this.allCards.filter(card => 
            card.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 15); // Aumentou para 15 resultados
        
        suggestions.innerHTML = '';
        
        if (filtered.length > 0) {
            filtered.forEach(card => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                    <img src="https://images.digimoncard.io/images/cards/${card.cardnumber}.jpg" 
                         alt="${card.name}" 
                         class="suggestion-image"
                         onerror="this.style.display='none'">
                    <div class="suggestion-text">
                        <div class="suggestion-name">${card.name}</div>
                        <div class="suggestion-id">${card.cardnumber}</div>
                    </div>
                `;
                div.dataset.cardId = card.cardnumber;
                div.addEventListener('click', () => this.selectCard(card.cardnumber));
                suggestions.appendChild(div);
            });
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    }
    
    async selectCard(cardId) {
        if (this.gameWon) return;
        
        try {
            const response = await fetch(`https://digimoncard.io/api-public/search.php?card=${cardId}`);
            if (!response.ok) throw new Error('Erro ao buscar carta');
            const data = await response.json();
            const selectedCard = data[0];
            
            this.makeAttempt(selectedCard);
            
            document.getElementById('searchBox').value = '';
            document.getElementById('suggestions').style.display = 'none';
            
        } catch (error) {
            this.showError('Erro ao buscar carta. Tente novamente.');
        }
    }
    
    makeAttempt(card) {
        this.attempts.unshift(card); // Adiciona no início para ordem reversa
        this.updateStats();
        
        const comparison = this.compareCards(card, this.targetCard);
        this.displayAttempt(card, comparison);
        this.updateCorrectAttributes(comparison);
        
        if (card.id === this.targetCard.id) {
            this.gameWon = true;
            this.revealMysteryCard();
            setTimeout(() => this.showVictory(), 1000);
        }
    }
    
    compareCards(guess, target) {
        const comparison = {};
        
        const attributes = [
            { key: 'name', label: 'Name', type: 'string' },
            { key: 'level', label: 'Level', type: 'number' },
            { key: 'play_cost', label: 'Cost', type: 'number' },
            { key: 'evolution_cost', label: 'Evo', type: 'number' },
            { key: 'color', label: 'Color1', type: 'string' },
            { key: 'color2', label: 'Color2', type: 'string' },
            { key: 'digi_type', label: 'Type1', type: 'string' },
            { key: 'digi_type2', label: 'Type2', type: 'string' },
            { key: 'dp', label: 'DP', type: 'number' },
            { key: 'attribute', label: 'Attr', type: 'string' },
            { key: 'rarity', label: 'Rarity', type: 'string' },
            { key: 'form', label: 'Form', type: 'string' }
        ];
        
        attributes.forEach(attr => {
            const guessValue = guess[attr.key];
            const targetValue = target[attr.key];
            
            // Se acertou a carta, todos os atributos ficam verdes
            if (guess.id === target.id) {
                comparison[attr.key] = { status: 'correct', value: guessValue || '-', label: attr.label };
            }
            // Se ambos são nulos/vazios, considera neutro
            else if ((!guessValue || guessValue === '') && (!targetValue || targetValue === '')) {
                comparison[attr.key] = { status: 'neutral', value: '-', label: attr.label };
            }
            // Se valores são iguais e não nulos
            else if (guessValue === targetValue && guessValue !== null && guessValue !== '') {
                comparison[attr.key] = { status: 'correct', value: guessValue, label: attr.label };
            }
            // Para números, mostra setas
            else if (attr.type === 'number' && guessValue !== null && targetValue !== null) {
                const arrow = guessValue < targetValue ? '↑' : '↓';
                comparison[attr.key] = { 
                    status: 'wrong', 
                    value: guessValue, 
                    arrow: arrow,
                    label: attr.label 
                };
            }
            // Outros casos incorretos
            else {
                comparison[attr.key] = { 
                    status: 'wrong', 
                    value: guessValue || '-', 
                    label: attr.label 
                };
            }
        });
        
        return comparison;
    }
    
    displayAttempt(card, comparison) {
        const container = document.getElementById('attemptsContainer');
        const attemptDiv = document.createElement('div');
        attemptDiv.className = 'attempt';
        
        attemptDiv.innerHTML = `
            <img src="https://images.digimoncard.io/images/cards/${card.id}.jpg" alt="${card.name}" class="attempt-image" onerror="this.style.display='none'">
            <div class="attempt-content">
                <div class="attempt-header">${card.name} (${card.id})</div>
                <div class="attributes">
                    ${Object.values(comparison).map(attr => `
                        <div class="attribute ${attr.status}">
                            <div style="font-size: 0.6em;">${attr.label}</div>
                            <div class="value">${this.truncateValue(attr.value)}${attr.arrow ? `<span class="arrow">${attr.arrow}</span>` : ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.prepend(attemptDiv); // Adiciona no topo
        attemptDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    truncateValue(value) {
        if (typeof value === 'string' && value.length > 8) {
            return value.substring(0, 6) + '..';
        }
        return value;
    }
    
    updateCorrectAttributes(comparison) {
        Object.entries(comparison).forEach(([key, attr]) => {
            if (attr.status === 'correct' && attr.value !== '-' && attr.value !== '') {
                this.correctAttributes.add(`${attr.label}: ${attr.value}`);
            }
        });
        
        this.displayCorrectAttributes();
    }
    
    displayCorrectAttributes() {
        const container = document.getElementById('correctAttributes');
        
        if (this.correctAttributes.size === 0) {
            container.innerHTML = '<div style="color: rgba(255,255,255,0.7); font-size: 0.8em;">Acerte os atributos para revelar pistas!</div>';
            return;
        }
        
        container.innerHTML = Array.from(this.correctAttributes)
            .map(attr => `<div class="correct-item">${attr}</div>`)
            .join('');
    }
    
    revealMysteryCard() {
        const mysteryImage = document.getElementById('mysteryImage');
        mysteryImage.classList.add('revealed');
    }
    
    updateStats() {
        document.getElementById('attemptCount').textContent = `Tentativas: ${this.attempts.length}`;
        document.getElementById('correctCount').textContent = `Corretos: ${this.correctAttributes.size}/12`;
    }
    
    showVictory() {
        const modal = document.getElementById('victoryModal');
        const totalAttempts = this.attempts.length;
        
        document.getElementById('victoryAttempts').textContent = `${totalAttempts} tentativa${totalAttempts !== 1 ? 's' : ''}`;
        // Remove a linha de accuracy completamente
        document.getElementById('victoryAccuracy').style.display = 'none';
        
        // Remove qualquer estilo inline que possa estar sobrescrevendo
        modal.style.background = '';
        modal.style.cssText = 'display: flex !important';
        document.getElementById('searchContainer').style.display = 'none';
    }
    
    showGame() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mysterySection').style.display = 'block';
        document.getElementById('searchContainer').style.display = 'block';
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        document.getElementById('loading').style.display = 'none';
    }
}

function closeVictory() {
    document.getElementById('victoryModal').style.display = 'none';
}

// Inicializar o jogo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new DigimonTermoGame();
});

// Prevenir zoom no iOS quando focar inputs
document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
});